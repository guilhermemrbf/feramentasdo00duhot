import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from telethon import TelegramClient, types, errors
from telethon.sessions import StringSession
from local_app.forwarding import latest_selection
from local_app.engine import Engine
from local_app.store import Store
from local_app.domain import UserError


def message(value, album=None, protected=False):
    return types.Message(id=value, peer_id=types.PeerChannel(1),
        date=datetime(2020,1,1,tzinfo=timezone.utc), message='Caption **kept**',
        grouped_id=album, noforwards=protected)


async def stream(messages):
    for item in messages:
        yield item


class SelectionTests(unittest.IsolatedAsyncioTestCase):
    async def test_latest_100_are_sent_oldest_first(self):
        selected=await latest_selection(stream([message(i) for i in range(120,0,-1)]))
        self.assertEqual([m.id for m in selected],list(range(21,121)))

    async def test_album_would_overflow_is_entirely_excluded_without_filling_older_gaps(self):
        newest=[message(i) for i in range(120,22,-1)] # 98 individual messages
        selected=await latest_selection(stream(newest+[message(i,99) for i in (22,21,20)]+[message(19)]))
        self.assertEqual([m.id for m in selected],list(range(23,121)))

    async def test_album_at_exact_boundary_and_short_history(self):
        newest=[message(i) for i in range(120,22,-1)]
        selected=await latest_selection(stream(newest+[message(22,99),message(21,99),message(20)]))
        self.assertEqual(len(selected),100)
        self.assertEqual([m.id for m in selected[:2]],[21,22])
        selected=await latest_selection(stream([message(3,1),message(2,1),message(1)]))
        self.assertEqual([m.id for m in selected],[1,2,3])

    async def test_services_do_not_consume_selection_and_no_101st_send(self):
        service=types.MessageService(id=201,peer_id=types.PeerChannel(1),date=datetime.now(timezone.utc),action=types.MessageActionChatCreate('test',[]))
        result=await latest_selection(stream([service]+[message(i) for i in range(200,0,-1)]))
        self.assertEqual(len(result),100)
        self.assertEqual(result[0].id,101)


class ForwardTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.store=Store(Path(self.temp.name)/'fixture.db');self.engine=Engine(self.store)
        self.ids=list(range(1,101))
        self.tg=MagicMock()
        self.tg.get_messages=AsyncMock(return_value=[message(i) for i in self.ids])
        self.tg.forward_messages=AsyncMock(return_value=[message(i+1000) for i in self.ids])

    def tearDown(self):
        self.store.close();self.temp.cleanup()

    def job(self):
        job=self.store.create('1','2','Source','Destination','history',[],100,'forward100',self.ids)
        self.store.control(job,'start');return job

    async def process(self,job):
        with patch.object(self.engine,'connected',new=AsyncMock(return_value=self.tg)),patch.object(self.engine,'pair',new=AsyncMock(return_value=('src','dst'))):
            await self.engine.process(self.store.job(job))

    async def test_one_native_forward_preserves_caption_and_finishes(self):
        job=self.job();await self.process(job)
        self.tg.forward_messages.assert_awaited_once_with('dst',self.ids,from_peer='src',drop_author=True,drop_media_captions=False)
        self.assertEqual(self.store.job(job)['status'],'completed')
        self.assertEqual(self.store.message_counts()[job]['sent'],100)
        self.assertEqual(self.store.pending(job),[])
        self.tg.send_file.assert_not_called();self.tg.send_message.assert_not_called()
        self.assertEqual(json.loads(self.store.job(job)['selection']),self.ids)

    async def test_ambiguous_send_is_never_retried(self):
        job=self.job();self.tg.forward_messages.side_effect=TimeoutError()
        with self.assertRaises(TimeoutError):await self.process(job)
        self.assertEqual(self.store.pending(job),self.ids)
        with self.assertRaises(UserError):await self.process(job)
        self.assertEqual(self.tg.forward_messages.await_count,1)

    async def test_partial_confirmation_keeps_entire_selection_for_review(self):
        job=self.job();self.tg.forward_messages.return_value=[message(1001)]+[None]*99
        with self.assertRaises(UserError):await self.process(job)
        self.assertEqual(self.store.pending(job),self.ids)
        self.assertEqual(self.store.job(job)['checkpoint'],0)

    async def test_deleted_or_protected_selection_blocks_before_send(self):
        job=self.job()
        for items in ([message(1),None],[message(i,protected=i==50) for i in self.ids]):
            self.tg.get_messages.return_value=items
            with self.assertRaises(UserError):await self.process(job)
            self.assertEqual(self.store.pending(job),[])
        self.tg.forward_messages.assert_not_awaited()

    async def test_flood_wait_defers_same_selection(self):
        job=self.job();self.tg.forward_messages.side_effect=errors.FloodWaitError(request=None,capture=15)
        await self.process(job)
        self.assertEqual(self.store.pending(job),[])
        self.assertEqual(self.store.job(job)['status'],'running')
        self.assertEqual(json.loads(self.store.job(job)['selection']),self.ids)
        self.assertGreater(self.store.job(job)['next_run'],0)

    async def test_creation_freezes_latest_selection_paused_and_does_not_send(self):
        src=types.Channel(id=1,title='Source',photo=types.ChatPhotoEmpty(),date=datetime.now(timezone.utc))
        dst=types.Channel(id=2,title='Destination',photo=types.ChatPhotoEmpty(),date=datetime.now(timezone.utc))
        self.tg.get_messages.return_value=[message(150)]
        self.tg.iter_messages=lambda *args,**kwargs:stream([message(i) for i in range(150,0,-1)])
        with patch.object(self.engine,'connected',new=AsyncMock(return_value=self.tg)),patch.object(self.engine,'pair',new=AsyncMock(return_value=(src,dst))):
            job=await self.engine.create('1','2','history',[],True)
        saved=self.store.job(job)
        self.assertEqual(json.loads(saved['selection']),list(range(51,151)))
        self.assertEqual(saved['status'],'paused')
        self.assertEqual(saved['copy_method'],'forward100')
        self.tg.forward_messages.assert_not_awaited()

    async def test_pinned_telethon_builds_single_request_with_requested_flags(self):
        client=TelegramClient(StringSession(),123,'a'*32)
        peer=types.InputPeerChannel(1,1)
        with patch.object(client,'get_input_entity',new=AsyncMock(return_value=peer)),patch.object(client,'get_peer_id',new=AsyncMock(return_value=-1001)),patch.object(TelegramClient,'__call__',new=AsyncMock(return_value=object())) as call,patch.object(client,'_get_response_message',return_value=[message(i) for i in self.ids]):
            await client.forward_messages(peer,self.ids,from_peer=peer,drop_author=True,drop_media_captions=False)
        self.assertEqual(call.await_count,1)
        request=call.await_args.args[0]
        self.assertTrue(request.drop_author);self.assertFalse(request.drop_media_captions)
        self.assertEqual(request.id,self.ids)
