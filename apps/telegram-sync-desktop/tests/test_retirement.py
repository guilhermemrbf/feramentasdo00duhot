"""Upgrade coverage using synthetic, in-memory pre-0.7.1 databases only."""
import asyncio
import json
import sqlite3
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from telethon import types

from local_app.editor import DEFAULT_URL, decode_entities, snapshot
from local_app.engine import Engine
from local_app.runtime import Runtime
from local_app.store import Store


# Frozen 0.7.0 editor snapshots: the media and visible label stay unchanged.
ORIGINAL = ('{"text":"VIP","entities":["J9OmdgAAAAADAAAAE2h0dHBzOi8vb2xkLmV4YW1wbGU="],'
            '"media":["MessageMediaDocument",987],"preview":false,"buttons":null}')
DESIRED = ('{"text":"VIP","entities":["J9OmdgAAAAADAAAAImh0dHBzOi8vdC5tZS92aXBhY2Vzc29saWJlcmFkb19ib3QA"],'
           '"media":["MessageMediaDocument",987],"preview":false,"buttons":null}')


class LegacyDatabase:
    def setUp(self):
        # No session, user file, credential encryption, or network is involved.
        connection = sqlite3.connect(':memory:', check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.executescript('''
            pragma foreign_keys=ON;
            create table settings (key text primary key, value text not null);
            create table jobs (
                id integer primary key, source text not null, destination text not null,
                source_title text not null, destination_title text not null,
                mode text not null, status text not null, rules text not null,
                checkpoint integer not null, until_id integer not null,
                processed integer not null, error text, next_run real not null,
                authorized_at text not null, created_at text not null,
                copy_method text not null, selection text not null);
            create table messages (
                job_id integer not null references jobs(id) on delete cascade,
                source_id integer not null, state text not null,
                destination_ids text not null, primary key(job_id,source_id));
            create table logs (
                id integer primary key, job_id integer references jobs(id) on delete cascade,
                event text not null, created_at text not null);
            create table automations (
                id integer primary key, source text not null, destination text not null,
                source_title text not null, destination_title text not null,
                owner integer not null, target text not null, times text not null,
                state text not null default 'paused', next_run real not null default 0,
                note text not null default '', check(source<>destination));
            create table automation_runs (
                id integer primary key, automation_id integer not null references automations(id),
                groups_json text not null, target text not null, cursor integer not null default 0,
                state text not null default 'ready', retry_at real not null default 0,
                created_at real not null);
            create unique index automation_one_pending_run on automation_runs(automation_id)
                where state='ready';
            create table automation_messages (
                automation_id integer not null references automations(id), source_id integer not null,
                run_id integer not null references automation_runs(id), state text not null,
                destination_id integer, primary key(automation_id,source_id));
            create table edit_batches (
                id integer primary key, channel text not null, title text not null,
                owner integer not null, target text not null, status text not null,
                scanned integer not null default 0, wait_until real not null default 0,
                note text not null default '', created_at text not null);
            create table edit_items (
                batch_id integer not null references edit_batches(id), message_id integer not null,
                original text not null, desired text not null, links text not null,
                status text not null default 'pending', note text not null default '',
                primary key(batch_id,message_id));
        ''')
        for index, state in enumerate(('running', 'paused', 'attention', 'completed', 'cancelled'), 1):
            connection.execute('insert into jobs values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (
                index, f'source-{index}', f'destination-{index}', 'Origem', 'Destino',
                'history', state, '[]', 11, 99, 4, 'Legacy note', 1,
                '2026-10-20T12:00:00+00:00', '2026-10-20T12:00:00+00:00',
                'rewrite' if index == 2 else 'forward100', '[]' if index == 2 else '[11, 12, 17]'))
            connection.executemany('insert into messages values (?,?,?,?)', [
                (index, 11, 'sent', '[901, 902]'),
                (index, 12, 'skipped', '[]'),
                (index, 17, 'sending' if state == 'attention' else 'sent',
                 '[]' if state == 'attention' else '[907]'),
            ])
            connection.execute('insert into logs values (?,?,?,?)', (
                index, index, 'Synthetic historical log', '2026-10-20T12:00:00+00:00'))
        for index, state in enumerate(('active', 'paused', 'attention', 'cancelled'), 1):
            connection.execute('insert into automations values (?,?,?,?,?,?,?,?,?,?,?)', (
                index, f'schedule-source-{index}', f'schedule-destination-{index}',
                'Origem da agenda', 'Destino da agenda', 321, DEFAULT_URL,
                '["00:00", "12:30"]', state, 1, 'Legacy schedule note'))
            connection.execute('insert into automation_runs values (?,?,?,?,?,?,?,?)', (
                index, index, '[[21, 22], [29]]', DEFAULT_URL, 1,
                'abandoned' if state == 'cancelled' else 'ready', 2, 100))
            connection.executemany('insert into automation_messages values (?,?,?,?,?)', [
                (index, 21, index, 'sent', 801),
                (index, 22, index, 'sent', 802),
                (index, 29, index, 'sending', None),
            ])
        for index, state in enumerate(('ready', 'paused', 'done'), 1):
            connection.execute('insert into edit_batches values (?,?,?,?,?,?,?,?,?,?)', (
                index, '-1000000000123', 'Canal de teste', 321, DEFAULT_URL,
                state, 1, 0, 'Legacy editor note', '2026-10-20T12:00:00+00:00'))
            connection.execute('insert into edit_items values (?,?,?,?,?,?,?)', (
                index, 7, ORIGINAL, DESIRED, '["https://old.example"]',
                'applied' if state == 'done' else 'pending', 'Legacy item note'))
        connection.executemany('insert into settings values (?,?)', [
            ('account', 'synthetic-sealed-account'), ('rules', '[{"old":"preserved"}]')])
        connection.commit()
        self.before = self.tables(connection)
        with patch('local_app.store.sqlite3.connect', return_value=connection):
            self.store = Store(':memory:')
        self.addCleanup(self.store.close)

    @staticmethod
    def tables(connection):
        names = ('jobs', 'messages', 'logs', 'automations', 'automation_runs',
                 'automation_messages', 'edit_batches', 'edit_items', 'settings')
        return {name: [dict(row) for row in connection.execute(f'select * from {name} order by rowid')]
                for name in names}


class RetirementMigrationTests(LegacyDatabase, unittest.TestCase):
    def test_upgrade_cancels_live_jobs_and_agendas_without_losing_history(self):
        Engine(self.store)
        after = self.tables(self.store.conn)
        for before, current in zip(self.before['jobs'], after['jobs']):
            with self.subTest(job=before['status']):
                if before['status'] in ('running', 'paused', 'attention'):
                    self.assertEqual(current['status'], 'cancelled')
                    self.assertEqual(current['next_run'], 0)
                    self.assertIn('0.7.1', current['error'])
                    for key in ('status', 'next_run', 'error'):
                        current[key] = before[key]
                self.assertEqual(current, before)
        for before, current in zip(self.before['automations'], after['automations']):
            with self.subTest(agenda=before['state']):
                if before['state'] != 'cancelled':
                    self.assertEqual(current['state'], 'cancelled')
                    self.assertEqual(current['next_run'], 0)
                    self.assertIn('0.7.1', current['note'])
                    for key in ('state', 'next_run', 'note'):
                        current[key] = before[key]
                self.assertEqual(current, before)
        for name in ('messages', 'logs', 'automation_runs', 'automation_messages', 'edit_batches', 'edit_items'):
            with self.subTest(preserved_table=name):
                self.assertEqual(after[name], self.before[name])
        self.assertEqual(self.store.setting('account'), 'synthetic-sealed-account')
        self.assertEqual(self.store.setting('rules'), '[{"old":"preserved"}]')
        self.assertEqual(self.store.setting('publication_features_retired'), '1')
        self.assertEqual(self.store.publication_edges(), [])
        self.assertEqual(self.store.pending(3), [17])

    def test_reopening_the_editor_is_idempotent(self):
        Engine(self.store)
        first_start = self.tables(self.store.conn)
        Engine(self.store)
        self.assertEqual(self.tables(self.store.conn), first_start)

    def test_fresh_install_does_not_create_retired_automation_tables(self):
        store = Store(':memory:')
        try:
            Engine(store)
            names = {row['name'] for row in store.conn.execute("select name from sqlite_master where type='table'")}
            self.assertTrue({'edit_batches', 'edit_items'} <= names)
            self.assertTrue({'automations', 'automation_runs', 'automation_messages'}.isdisjoint(names))
            self.assertEqual(store.setting('publication_features_retired'), '1')
        finally:
            store.close()

    def test_runtime_starts_idle_with_due_legacy_agendas_and_saved_account(self):
        tg = MagicMock()
        for name in ('connect', 'send_message', 'send_file', 'forward_messages'):
            setattr(tg, name, AsyncMock())

        async def pending_tasks():
            current = asyncio.current_task()
            return [task.get_coro().__qualname__ for task in asyncio.all_tasks() if task is not current]

        with patch('local_app.engine.telegram_client', return_value=tg) as factory, \
                patch.object(Engine, 'connected', new=AsyncMock(return_value=tg)) as connected:
            runtime = Runtime(self.store)
            try:
                tasks = asyncio.run_coroutine_threadsafe(pending_tasks(), runtime.loop).result(timeout=1)
                self.assertEqual(tasks, [], 'Starting the editor must not schedule a publisher or agenda worker.')
                connected.assert_not_awaited()
                factory.assert_not_called()
                for name in ('connect', 'send_message', 'send_file', 'forward_messages'):
                    getattr(tg, name).assert_not_called()
                tg.assert_not_called()  # Also detects raw Telegram requests such as ForwardMessagesRequest.
                self.assertTrue(all(row['status'] == 'cancelled' for row in self.store.jobs()
                                    if row['id'] in (1, 2, 3)))
            finally:
                runtime.close()
                runtime.thread.join(timeout=1)
                self.assertFalse(runtime.thread.is_alive(), 'The idle runtime must close promptly.')


class RetiredAccountAndEditorTests(LegacyDatabase, unittest.IsolatedAsyncioTestCase):
    async def test_disconnect_removes_saved_account_while_preserving_pending_ledgers(self):
        engine = Engine(self.store)
        connected = AsyncMock(side_effect=AssertionError('Disconnect must not reconnect.'))
        engine.connected = connected
        client = MagicMock(disconnect=AsyncMock())
        engine.client = client
        ledger = self.tables(self.store.conn)
        await engine.disconnect()
        self.assertEqual(self.store.setting('account'), '')
        client.disconnect.assert_awaited_once_with()
        connected.assert_not_awaited()
        self.assertIsNone(engine.client)
        after = self.tables(self.store.conn)
        for name in ('messages', 'automation_runs', 'automation_messages', 'edit_batches', 'edit_items'):
            with self.subTest(preserved_table=name):
                self.assertEqual(after[name], ledger[name])
        self.assertEqual(self.store.pending(3), [17])
        self.assertIsNone(after['automation_messages'][2]['destination_id'])

    async def test_existing_editor_backup_can_apply_and_restore_after_upgrade(self):
        engine = Engine(self.store)
        self.assertEqual(self.tables(self.store.conn)['edit_items'], self.before['edit_items'])
        channel = types.Channel(id=123, title='Canal de teste', photo=types.ChatPhotoEmpty(),
                                date=datetime.now(timezone.utc), broadcast=True, noforwards=True)
        tg = MagicMock()
        tg.get_me = AsyncMock(return_value=SimpleNamespace(id=321))
        tg.get_entity = AsyncMock(return_value=channel)
        tg.get_permissions = AsyncMock(return_value=SimpleNamespace(is_creator=True, is_admin=True, edit_messages=True))
        media = types.MessageMediaDocument(document=types.DocumentEmpty(987))
        current = types.Message(id=7, peer_id=types.PeerChannel(123), date=datetime.now(timezone.utc),
                                message='VIP', entities=decode_entities(json.loads(ORIGINAL)['entities']), media=media)
        tg.get_messages = AsyncMock(side_effect=lambda *args, **kwargs: current)

        async def edit(*args, **kwargs):
            current.message = kwargs['text']
            current.entities = kwargs['formatting_entities']
            return current

        tg.edit_message = AsyncMock(side_effect=edit)
        engine.connected = AsyncMock(return_value=tg)
        with patch('local_app.editor.asyncio.sleep', new=AsyncMock()):
            await engine.editor.apply(1)
            self.assertEqual(snapshot(current), json.loads(DESIRED))
            self.assertEqual(engine.editor.db.items(1)[0]['status'], 'applied')
            await engine.editor.apply(1, restore=True)
        self.assertEqual(snapshot(current), json.loads(ORIGINAL))
        restored = engine.editor.db.items(1)[0]
        self.assertEqual(restored['status'], 'restored')
        self.assertEqual(restored['original'], ORIGINAL)
        self.assertEqual(restored['desired'], DESIRED)
        self.assertEqual(tg.edit_message.await_count, 2)
        for call in tg.edit_message.await_args_list:
            self.assertNotIn('file', call.kwargs)
            self.assertNotIn('buttons', call.kwargs)
        for name in ('send_message', 'send_file', 'forward_messages', 'download_media', 'delete_messages'):
            getattr(tg, name).assert_not_called()
        tg.assert_not_called()
        after = self.tables(self.store.conn)
        for name in ('messages', 'automation_runs', 'automation_messages'):
            self.assertEqual(after[name], self.before[name])


if __name__ == '__main__':
    unittest.main()
