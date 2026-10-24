import asyncio
import copy
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from telethon import errors, types
from local_app.domain import UserError
from local_app.editor import DEFAULT_URL, EditStore, encode_entities, decode_entities, snapshot, rewrite
from local_app.engine import Engine
from local_app.store import Store


def post(text='🎓 Curso\nVEJA NO VIP', entities=None, **kwargs):
    return types.Message(id=7,peer_id=types.PeerChannel(123),date=datetime.now(timezone.utc),message=text,
        entities=entities if entities is not None else [types.MessageEntityBold(3,5),types.MessageEntityTextUrl(9,11,'https://old.example')],**kwargs)


class RewriteTests(unittest.TestCase):
    def test_preserves_visible_text_media_and_utf16_formatting(self):
        media=types.MessageMediaDocument(document=types.DocumentEmpty(100))
        original=snapshot(post(media=media))
        desired,links=rewrite(original,DEFAULT_URL)
        self.assertEqual(desired['text'],original['text'])
        self.assertEqual(desired['media'],original['media'])
        entities=decode_entities(desired['entities'])
        self.assertEqual((entities[1].offset,entities[1].length),(9,11))
        self.assertEqual(entities[1].url,DEFAULT_URL)
        self.assertEqual(encode_entities(entities[:1]),original['entities'][:1])
        self.assertEqual(links,['https://old.example'])
        self.assertEqual(decode_entities(original['entities'])[1].url,'https://old.example')

    def test_exact_ad_lines_only_and_offsets_after_removal(self):
        text='👑 outros grupos\nHentai\n🎓 Curso sobre outros grupos\nACESSAR'
        offset=len(text[:text.index('ACESSAR')].encode('utf-16-le'))//2
        original=snapshot(post(text,[types.MessageEntityTextUrl(offset,7,'https://old.example')]))
        desired,_=rewrite(original,DEFAULT_URL,True)
        self.assertEqual(desired['text'],'🎓 Curso sobre outros grupos\nACESSAR')
        entity=decode_entities(desired['entities'])[0]
        label=desired['text'].encode('utf-16-le')[entity.offset*2:(entity.offset+entity.length)*2].decode('utf-16-le')
        self.assertEqual(label,'ACESSAR')

    def test_drops_removed_link_and_trims_cross_line_formatting(self):
        text='Curso\nHentai\nVIP'
        original=snapshot(post(text,[types.MessageEntityBold(0,len(text)),types.MessageEntityTextUrl(6,6,'https://ads.example'),types.MessageEntityTextUrl(13,3,'https://old.example')]))
        desired,links=rewrite(original,DEFAULT_URL,True)
        entities=decode_entities(desired['entities'])
        self.assertEqual(desired['text'],'Curso\nVIP')
        self.assertEqual(len(entities),2)
        self.assertEqual(entities[0].length,9)
        self.assertEqual(entities[1].offset,6)
        self.assertEqual(links,['https://old.example'])

    def test_never_erases_whole_post(self):
        self.assertIsNone(rewrite(snapshot(post('👑 outros grupos\nHentai',[])),DEFAULT_URL,True))

    def test_already_correct_is_noop(self):
        original=snapshot(post());desired,_=rewrite(original,DEFAULT_URL)
        self.assertIsNone(rewrite(desired,DEFAULT_URL))
        self.assertIsNone(rewrite(snapshot(post('Curso sem link',[])),DEFAULT_URL))

    def test_plain_urls_opt_in_preserves_label(self):
        text='https://old.example'
        original=snapshot(post(text,[types.MessageEntityUrl(0,len(text))]))
        self.assertIsNone(rewrite(original,DEFAULT_URL))
        desired,_=rewrite(original,DEFAULT_URL,plain_urls=True)
        self.assertEqual(desired['text'],text)
        self.assertEqual(decode_entities(desired['entities'])[0].url,DEFAULT_URL)

    def test_rejects_invalid_targets(self):
        for target in ('file:///test','javascript:foo','http://example.com','https://user:pass@example.com','https://a.com/ bad'):
            with self.assertRaises(UserError):rewrite(snapshot(post()),target)


class EditorTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.store=Store(Path(self.temp.name)/'test.sqlite3');self.engine=Engine(self.store);self.editor=self.engine.editor
        self.channel=types.Channel(id=123,title='Canal de teste',photo=types.ChatPhotoEmpty(),date=datetime.now(timezone.utc),broadcast=True,noforwards=True)
        self.tg=MagicMock();self.tg.get_entity=AsyncMock(return_value=self.channel)
        self.tg.get_permissions=AsyncMock(return_value=SimpleNamespace(is_creator=True,is_admin=True,edit_messages=True))
        self.tg.get_me=AsyncMock(return_value=SimpleNamespace(id=321))
        self.engine.connected=AsyncMock(return_value=self.tg)
        self.current=post();self.edits=[]
        self.tg.get_messages=AsyncMock(side_effect=lambda *a,**k:self.current)
        async def edit(*args,**kwargs):
            self.edits.append(kwargs)
            self.current=post(kwargs['text'],kwargs['formatting_entities'])
            return self.current
        self.tg.edit_message=AsyncMock(side_effect=edit)
        async def messages(*a,**k):yield self.current
        self.tg.iter_messages=messages
        self.sleep=patch('local_app.editor.asyncio.sleep',new=AsyncMock());self.sleep.start()
    def tearDown(self):
        self.sleep.stop();self.store.close();self.temp.cleanup()

    async def prepared(self):
        return await self.editor.scan('-100123',DEFAULT_URL)

    async def test_scan_is_read_only_and_own_protected_channel_edit_works(self):
        batch=await self.prepared()
        self.tg.edit_message.assert_not_awaited()
        self.assertEqual(len(self.editor.db.items(batch)),1)
        await self.editor.apply(batch)
        self.assertEqual(self.editor.db.items(batch)[0]['status'],'applied')
        self.assertEqual(self.edits[0]['text'],'🎓 Curso\nVEJA NO VIP')
        self.assertNotIn('file',self.edits[0]);self.assertNotIn('buttons',self.edits[0])
        self.tg.send_message.assert_not_called();self.tg.send_file.assert_not_called();self.tg.delete_messages.assert_not_called()

    async def test_restores_original_entities_and_text(self):
        original=snapshot(self.current);batch=await self.prepared();await self.editor.apply(batch);await self.editor.apply(batch,True)
        self.assertEqual(snapshot(self.current),original)
        self.assertEqual(self.editor.db.items(batch)[0]['status'],'restored')

    async def test_detects_manual_changes(self):
        batch=await self.prepared();self.current.message='Post editado manualmente'
        await self.editor.apply(batch)
        self.assertEqual(self.editor.db.items(batch)[0]['status'],'conflict');self.tg.edit_message.assert_not_awaited()

    async def test_restore_does_not_overwrite_new_content(self):
        batch=await self.prepared();await self.editor.apply(batch);self.current.message='Nova legenda manual'
        await self.editor.apply(batch,True)
        self.assertEqual(self.current.message,'Nova legenda manual');self.assertEqual(len(self.edits),1)

    async def test_missing_post_is_not_recreated(self):
        batch=await self.prepared();self.current=None
        await self.editor.apply(batch)
        self.assertEqual(self.editor.db.items(batch)[0]['status'],'conflict');self.tg.edit_message.assert_not_awaited()

    async def test_permission_rechecked_before_write(self):
        batch=await self.prepared()
        self.tg.get_permissions.return_value=SimpleNamespace(is_creator=False,is_admin=True,edit_messages=False)
        with self.assertRaises(UserError):await self.editor.apply(batch)
        self.tg.edit_message.assert_not_awaited()

    async def test_no_permission_scan_does_not_persist_batch(self):
        self.tg.get_permissions.return_value=SimpleNamespace(is_creator=False,is_admin=False,edit_messages=False)
        with self.assertRaises(UserError):await self.prepared()
        self.assertEqual(self.editor.db.batches(),[])

    async def test_lists_only_channels_with_edit_rights(self):
        denied=copy.copy(self.channel);denied.id=124;denied.creator=False;denied.admin_rights=types.ChatAdminRights(post_messages=True,edit_messages=False)
        allowed=copy.copy(self.channel);allowed.creator=True
        group=copy.copy(allowed);group.id=125;group.broadcast=False
        async def dialogs():
            for entity in (allowed,denied,group):yield SimpleNamespace(entity=entity)
        self.tg.iter_dialogs=dialogs
        self.assertEqual(await self.editor.channels(),[('-1000000000123','Canal de teste')])

    async def test_account_must_match(self):
        batch=await self.prepared();self.tg.get_me.return_value=SimpleNamespace(id=999)
        with self.assertRaises(UserError):await self.editor.apply(batch)
        self.tg.edit_message.assert_not_awaited()

    async def test_timeout_after_accepted_edit_recovers_without_duplicate_write(self):
        batch=await self.prepared();write=self.tg.edit_message.side_effect
        async def ambiguous(*a,**kw):
            await write(*a,**kw)
            raise TimeoutError('private raw data')
        self.tg.edit_message.side_effect=ambiguous
        with self.assertRaises(TimeoutError):await self.editor.apply(batch)
        self.assertEqual(self.editor.db.items(batch)[0]['status'],'pending')
        self.assertNotIn('private raw data',self.editor.db.batch(batch)['note'])
        await self.editor.apply(batch)
        self.assertEqual(self.editor.db.items(batch)[0]['status'],'applied');self.assertEqual(len(self.edits),1)

    async def test_floodwait_persists_and_blocks_early_retry(self):
        batch=await self.prepared();self.tg.edit_message.side_effect=errors.FloodWaitError(None,capture=15)
        async def pause_wait(batch):
            self.editor.db.patch(batch,status='paused')
            return False
        with patch.object(self.editor,'wait_limit',side_effect=pause_wait):await self.editor.apply(batch)
        self.assertEqual(self.editor.db.batch(batch)['status'],'paused')
        with self.assertRaises(UserError):await self.editor.apply(batch)
        self.assertEqual(self.tg.edit_message.await_count,1)

    async def test_pause_between_posts(self):
        batch=await self.prepared();item=self.editor.db.items(batch)[0]
        self.editor.db.add(batch,8,json.loads(item['original']),json.loads(item['desired']),json.loads(item['links']))
        write=self.tg.edit_message.side_effect
        async def pause(*a,**kw):
            result=await write(*a,**kw);self.editor.cancel.set();return result
        self.tg.edit_message.side_effect=pause
        await self.editor.apply(batch)
        self.assertEqual(self.editor.db.batch(batch)['status'],'paused');self.assertEqual(len(self.edits),1)

    async def test_scan_skips_inline_keyboard(self):
        self.current.reply_markup=types.ReplyInlineMarkup([[types.KeyboardButtonUrl('VIP','https://old.example')]])
        batch=await self.prepared();self.assertEqual(self.editor.db.items(batch),[])

    async def test_scan_interruption_cannot_apply_partial_preview(self):
        async def interrupted(*a,**kw):
            yield self.current
            raise ConnectionError('secret')
        self.tg.iter_messages=interrupted
        with self.assertRaises(ConnectionError):await self.prepared()
        batch=self.editor.db.batches()[0]['id']
        self.assertEqual(self.editor.db.batch(batch)['status'],'incomplete')
        with self.assertRaises(UserError):await self.editor.apply(batch)
        self.tg.edit_message.assert_not_awaited()

    async def test_sync_must_be_paused(self):
        job=self.store.create('1','2','A','B','history',[],0);self.store.control(job,'start')
        with self.assertRaises(UserError):await self.prepared()
        self.engine.connected.assert_not_awaited()

    async def test_restart_recovers_batches_without_losing_original_backup(self):
        batch=await self.prepared();self.editor.db.patch(batch,status='applying')
        original=self.editor.db.items(batch)[0]['original']
        self.store.close();self.store=Store(Path(self.temp.name)/'test.sqlite3');db=EditStore(self.store)
        self.assertEqual(db.batch(batch)['status'],'paused')
        self.assertEqual(db.items(batch)[0]['original'],original)

    async def test_apply_only_selected_posts_leaves_other_proposals_pending(self):
        batch=await self.prepared();item=self.editor.db.items(batch)[0]
        self.editor.db.add(batch,8,json.loads(item['original']),json.loads(item['desired']),json.loads(item['links']))
        await self.editor.apply(batch,message_ids=[7])
        self.assertEqual([i['status'] for i in self.editor.db.items(batch)],['applied','pending'])
        self.assertEqual(self.editor.db.batch(batch)['status'],'ready')
        self.assertEqual(len(self.edits),1)

    async def test_invalid_or_foreign_selection_is_rejected_before_network(self):
        batch=await self.prepared();self.engine.connected.reset_mock()
        for selection in ([],[0],['7'],[999],[True]):
            with self.assertRaises(UserError):await self.editor.apply(batch,message_ids=selection)
        self.engine.connected.assert_not_awaited();self.tg.edit_message.assert_not_awaited()

    async def test_whole_batch_continues_past_uneditable_post_and_emits_live_progress(self):
        messages={mid:post() for mid in (7,8,9)}
        for mid,message in messages.items():message.id=mid
        async def history(*a,**k):
            for message in messages.values():yield message
        self.tg.iter_messages=history
        self.tg.get_messages=AsyncMock(side_effect=lambda *a,**k:messages[k['ids']])
        async def edit(channel,mid,**kwargs):
            if mid==8:raise errors.MessageEditTimeExpiredError(None)
            messages[mid]=post(kwargs['text'],kwargs['formatting_entities']);messages[mid].id=mid
        self.tg.edit_message=AsyncMock(side_effect=edit)
        self.engine.emit=MagicMock()
        batch=await self.prepared();await self.editor.apply(batch)
        self.assertEqual([i['status'] for i in self.editor.db.items(batch)],['applied','conflict','applied'])
        self.assertEqual(self.tg.edit_message.await_count,3)
        self.assertEqual(self.editor.db.batch(batch)['status'],'done')
        self.assertTrue(any('post 9' in str(call).lower() for call in self.engine.emit.call_args_list))
        await self.editor.apply(batch)
        self.assertEqual(self.tg.edit_message.await_count,3)

    async def test_floodwait_automatically_resumes_same_post_without_second_apply(self):
        batch=await self.prepared();write=self.tg.edit_message.side_effect
        calls=0
        async def limited(*a,**kw):
            nonlocal calls
            calls+=1
            if calls==1:raise errors.FloodWaitError(None,capture=5)
            return await write(*a,**kw)
        self.tg.edit_message.side_effect=limited
        async def elapsed(batch):
            self.assertEqual(self.editor.db.batch(batch)['status'],'applying')
            self.assertGreater(self.editor.db.batch(batch)['wait_until'],0)
            self.editor.db.patch(batch,wait_until=0)
            return True
        with patch.object(self.editor,'wait_limit',side_effect=elapsed) as wait:
            await self.editor.apply(batch)
            wait.assert_awaited_once_with(batch)
        self.assertEqual(calls,2)
        self.assertEqual(self.editor.db.items(batch)[0]['status'],'applied')
        self.assertEqual(self.editor.db.batch(batch)['status'],'done')

    async def test_wait_countdown_is_cancellable_and_persists_deadline(self):
        batch=await self.prepared();self.editor.db.patch(batch,wait_until=106)
        self.engine.emit=MagicMock()
        clock=[100]
        async def advance(seconds):clock[0]+=seconds
        with patch('local_app.editor.time.time',side_effect=lambda:clock[0]),patch('local_app.editor.asyncio.sleep',side_effect=advance):
            self.assertTrue(await self.editor.wait_limit(batch))
        self.assertEqual(clock[0],106)
        self.assertEqual(self.editor.db.batch(batch)['wait_until'],0)
        self.assertTrue(any('automática' in str(c) for c in self.engine.emit.call_args_list))
        self.editor.db.patch(batch,wait_until=200);self.editor.cancel.set()
        self.assertFalse(await self.editor.wait_limit(batch))
        self.assertEqual(self.editor.db.batch(batch)['status'],'paused')
        self.assertEqual(self.editor.db.batch(batch)['wait_until'],200)
