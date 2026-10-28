import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from telethon import types, errors
from local_app.automation import schedule_times, next_slot, prepared, AutomationStore
from local_app.domain import UserError
from local_app.engine import Engine


TARGET='https://new.example/join'


def post(value,album=None,media=None,**kwargs):
    return types.Message(id=value,peer_id=types.PeerChannel(1),date=datetime(2020,1,1,tzinfo=timezone.utc),
        message='😎 VIP https://old.example',entities=[types.MessageEntityBold(3,3),types.MessageEntityTextUrl(3,3,'https://old.example/hidden'),types.MessageEntityUrl(7,19)],grouped_id=album,media=media,**kwargs)


class ScheduleTests(unittest.TestCase):
    def test_one_to_five_unique_valid_hours_only(self):
        self.assertEqual(schedule_times(['18:00','09:00']),['09:00','18:00'])
        for value in ([],['09:00']*2,['9:00'],['24:00'],['12:60'],['09:00']*6,'09:00'):
            with self.assertRaises(UserError):schedule_times(value)

    def test_future_slots_midnight_and_year_rollover(self):
        today=datetime(2026,12,31,23,59).timestamp()
        self.assertEqual(datetime.fromtimestamp(next_slot(['00:00','09:00'],today)),datetime(2027,1,1,0,0))
        at_nine=datetime(2026,10,28,9,0).timestamp()
        self.assertEqual(datetime.fromtimestamp(next_slot(['09:00','18:00'],at_nine)),datetime(2026,10,28,18,0))

    def test_rewrite_is_prepared_before_send_and_keeps_utf16_text_and_media(self):
        original=post(1,media=types.MessageMediaPhoto(types.PhotoEmpty(1)))
        desired=prepared(original,TARGET)
        from local_app.editor import decode_entities
        entities=decode_entities(desired['entities'])
        self.assertEqual(desired['text'],original.message)
        self.assertEqual((entities[0].offset,entities[0].length),(3,3))
        self.assertEqual([entity.url for entity in entities if isinstance(entity,types.MessageEntityTextUrl)],[TARGET,TARGET])
        self.assertEqual(original.entities[1].url,'https://old.example/hidden')


class AutomationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        from local_app.store import Store
        self.store=Store(Path(self.temp.name)/'fixture.sqlite3');self.engine=Engine(self.store);self.auto=self.engine.automation;self.db=self.auto.db
        self.now=datetime(2026,10,28,9).timestamp()
        self.identifier=self.db.save('1','2','Source','Destination',7,TARGET,['09:00','18:00'])
        self.messages={i:post(i) for i in range(1,104)}
        self.visible=100
        self.tg=MagicMock();self.tg.get_me=AsyncMock(return_value=SimpleNamespace(id=7))
        async def get_messages(_src,ids=None,limit=None):
            return [self.messages.get(value) for value in ids] if ids is not None else [self.messages[self.visible]]
        async def history(_src,**options):
            for value in sorted(self.messages,reverse=True):
                if value<=self.visible and value<options['max_id']:yield self.messages[value]
        self.tg.get_messages=AsyncMock(side_effect=get_messages);self.tg.iter_messages=history
        self.tg.send_message=AsyncMock(side_effect=lambda *a,**kw:post(1000+self.tg.send_message.await_count))
        self.tg.send_file=AsyncMock(return_value=post(2000))
        self.engine.connected=AsyncMock(return_value=self.tg);self.engine.pair=AsyncMock(return_value=('src','dst'))

    def tearDown(self):self.store.close();self.temp.cleanup()

    def activate_due(self):self.db.patch(self.identifier,state='active',next_run=self.now)

    async def test_save_and_activate_do_not_send_until_future_slot(self):
        self.assertEqual(self.db.row(self.identifier)['state'],'paused')
        self.db.control(self.identifier,'activate',self.now)
        await self.auto.tick(self.now+1)
        self.engine.connected.assert_not_awaited();self.tg.send_message.assert_not_awaited()
        self.assertEqual(self.db.row(self.identifier)['next_run'],next_slot(['09:00','18:00'],self.now))

    async def test_copy_100_then_only_three_new_at_next_slot(self):
        self.activate_due()
        for second in range(100):await self.auto.tick(self.now+second)
        self.assertEqual(self.db.row(self.identifier)['sent'],100)
        self.assertIsNone(self.db.run(self.identifier))
        payload=self.tg.send_message.await_args.kwargs
        self.assertEqual([entity.url for entity in payload['formatting_entities'] if isinstance(entity,types.MessageEntityTextUrl)],[TARGET,TARGET])
        self.tg.forward_messages.assert_not_called();self.tg.edit_message.assert_not_called()
        self.visible=103;later=self.now+9*3600;self.db.patch(self.identifier,next_run=later)
        for second in range(3):await self.auto.tick(later+second)
        self.assertEqual(self.db.row(self.identifier)['sent'],103)
        self.assertEqual(self.tg.send_message.await_count,103)
        self.assertIsNone(self.db.run(self.identifier))
        self.db.patch(self.identifier,next_run=later+10);await self.auto.tick(later+10)
        self.assertEqual(self.tg.send_message.await_count,103)

    async def test_oldest_outside_recent_100_not_imported(self):
        self.visible=103;self.activate_due();await self.auto.tick(self.now)
        groups=json.loads(self.db.run(self.identifier)['groups_json'])
        self.assertEqual([value for group in groups for value in group],list(range(4,104)))

    async def test_album_counted_per_media_and_preserved_as_one_request(self):
        self.messages={1:post(1,77,types.MessageMediaPhoto(types.PhotoEmpty(1))),2:post(2,77,types.MessageMediaPhoto(types.PhotoEmpty(2)))};self.visible=2
        self.tg.send_file.return_value=[post(101),post(102)]
        self.activate_due();await self.auto.tick(self.now)
        self.assertEqual(self.db.row(self.identifier)['sent'],2)
        payload=self.tg.send_file.await_args.kwargs
        self.assertEqual(len(payload['formatting_entities']),2)
        self.assertEqual(payload['caption'],[self.messages[1].message,self.messages[2].message])
        self.tg.send_file.assert_awaited_once();self.tg.send_message.assert_not_awaited()

    async def test_unsupported_or_protected_post_prevents_all_sends(self):
        self.messages[50].noforwards=True;self.activate_due();await self.auto.tick(self.now)
        self.assertEqual(self.db.row(self.identifier)['state'],'attention')
        self.assertEqual(self.db.row(self.identifier)['pending'],0)
        self.tg.send_message.assert_not_awaited()

    async def test_timeout_requires_review_and_is_not_retried(self):
        self.tg.send_message.side_effect=TimeoutError('private text')
        self.activate_due();await self.auto.tick(self.now);await self.auto.tick(self.now+1)
        self.assertEqual(self.tg.send_message.await_count,1)
        self.assertEqual(self.db.row(self.identifier)['pending'],1)
        self.assertEqual(self.db.row(self.identifier)['state'],'attention')
        self.assertNotIn('private text',self.db.row(self.identifier)['note'])
        with self.assertRaises(UserError):self.db.control(self.identifier,'activate',self.now)
        self.db.resolve(self.identifier,'sent')
        self.assertEqual(self.db.row(self.identifier)['sent'],1)
        self.assertEqual(self.db.row(self.identifier)['state'],'paused')

    async def test_flood_wait_keeps_selection_and_waits_before_retry(self):
        self.tg.send_message.side_effect=errors.FloodWaitError(None,capture=30)
        self.activate_due();await self.auto.tick(self.now)
        run=self.db.run(self.identifier)
        self.assertEqual(self.db.row(self.identifier)['pending'],0)
        await self.auto.tick(self.now+2);self.assertEqual(self.tg.send_message.await_count,1)
        self.tg.send_message.side_effect=None;self.tg.send_message.return_value=post(1001)
        await self.auto.tick(self.now+31)
        self.assertEqual(self.db.run(self.identifier)['id'],run['id'])
        self.assertEqual(self.db.row(self.identifier)['sent'],1)

    async def test_missed_slots_skipped_without_catchup_or_network(self):
        self.activate_due();await self.auto.tick(self.now+301)
        self.engine.connected.assert_not_awaited();self.assertGreater(self.db.row(self.identifier)['next_run'],self.now+301)
        self.assertIn('pulado',self.db.row(self.identifier)['note'])

    async def test_pause_and_restart_keep_ledger_and_require_resume_for_unfinished_run(self):
        self.activate_due();await self.auto.tick(self.now)
        AutomationStore(self.store)
        self.assertEqual(self.db.row(self.identifier)['state'],'paused')
        self.assertEqual(self.db.row(self.identifier)['sent'],1)
        self.db.patch(self.identifier,state='active',next_run=self.now+2)
        await self.auto.tick(self.now+2)
        self.assertEqual(self.db.row(self.identifier)['sent'],2)

    async def test_restart_with_pending_is_attention_and_manual_retry_is_explicit(self):
        self.tg.send_message.side_effect=TimeoutError()
        self.activate_due();await self.auto.tick(self.now);AutomationStore(self.store)
        self.assertEqual(self.db.row(self.identifier)['state'],'attention')
        self.db.resolve(self.identifier,'retry')
        self.assertEqual(self.db.row(self.identifier)['pending'],0)
        self.assertIsNotNone(self.db.run(self.identifier))

    async def test_wrong_account_blocks_and_disconnect_cannot_revoke_active_agenda(self):
        self.activate_due();self.tg.get_me.return_value=SimpleNamespace(id=999)
        await self.auto.tick(self.now);self.tg.send_message.assert_not_awaited()
        with self.assertRaises(UserError):await self.engine.disconnect(revoke=True)
        self.tg.log_out.assert_not_called()

    async def test_cycles_duplicates_and_active_edits_block(self):
        with self.assertRaises(UserError):self.store.create('2','1','Back','Source','history',[],0)
        with self.assertRaises(UserError):self.db.save('2','1','Back','Source',7,TARGET,['09:00'])
        self.activate_due()
        with self.assertRaises(UserError):self.db.save('1','2','Source','Destination',7,TARGET,['12:00'],self.identifier)
        with self.assertRaises(UserError):self.engine.editor.idle_sync()

    async def test_invalid_input_blocks_before_network(self):
        for times in ([],['09:00']*6):
            with self.assertRaises(UserError):await self.auto.save('1','2',TARGET,times,True)
        with self.assertRaises(UserError):await self.auto.save('1','2','http://invalid',['09:00'],True)
        with self.assertRaises(UserError):await self.auto.save('1','2',TARGET,['09:00'],False)
        self.engine.connected.assert_not_awaited()

    async def test_partial_album_response_keeps_both_ids_pending_on_restart(self):
        self.messages={1:post(1,77,types.MessageMediaPhoto(types.PhotoEmpty(1))),2:post(2,77,types.MessageMediaPhoto(types.PhotoEmpty(2)))};self.visible=2
        self.tg.send_file.return_value=[post(101)]
        self.activate_due();await self.auto.tick(self.now);AutomationStore(self.store)
        self.assertEqual(self.db.row(self.identifier)['pending'],2)
        self.assertEqual(self.db.row(self.identifier)['sent'],0)
        self.assertEqual(self.db.row(self.identifier)['state'],'attention')
        await self.auto.tick(self.now+1);self.tg.send_file.assert_awaited_once()

    async def test_discard_keeps_dedup_and_does_not_delete_destination(self):
        self.activate_due();await self.auto.tick(self.now)
        self.db.control(self.identifier,'pause');self.db.control(self.identifier,'discard')
        self.assertIsNone(self.db.run(self.identifier))
        self.assertEqual(self.db.row(self.identifier)['sent'],1)
        self.tg.delete_messages.assert_not_called()

    async def test_saving_valid_definition_is_read_only_on_telegram_and_starts_paused(self):
        src=types.Channel(id=3,title='A',photo=types.ChatPhotoEmpty(),date=datetime.now(timezone.utc))
        dst=types.Channel(id=4,title='B',photo=types.ChatPhotoEmpty(),date=datetime.now(timezone.utc))
        self.engine.pair.return_value=(src,dst)
        identifier=await self.auto.save('3','4',TARGET,['09:00'],True)
        self.assertEqual(self.db.row(identifier)['state'],'paused')
        self.tg.send_message.assert_not_awaited();self.tg.send_file.assert_not_awaited()

    async def test_main_worker_dispatches_automation_tick(self):
        async def finish():self.engine.stopping=True
        with patch.object(self.auto,'tick',new=AsyncMock(side_effect=finish)) as tick,patch('local_app.engine.asyncio.sleep',new=AsyncMock()):
            await self.engine.run()
        tick.assert_awaited_once()

    async def test_recent_album_waits_without_error_or_partial_copy(self):
        self.messages[self.visible].grouped_id=77;self.messages[self.visible].date=datetime.now(timezone.utc)
        self.activate_due();await self.auto.tick(self.now)
        self.assertEqual(self.db.row(self.identifier)['state'],'active')
        self.assertEqual(self.db.row(self.identifier)['next_run'],self.now+5)
        self.assertIsNone(self.db.run(self.identifier));self.tg.send_message.assert_not_awaited()
