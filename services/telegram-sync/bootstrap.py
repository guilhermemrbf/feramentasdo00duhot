"""Fail early without exposing provider errors or credentials in deployment logs."""
import os
from cryptography.fernet import Fernet
import psycopg

REQUIRED = ('TELEGRAM_DATABASE_URL', 'TELEGRAM_API_ID', 'TELEGRAM_API_HASH',
            'TELEGRAM_ENCRYPTION_KEY', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY')


def validate_environment():
    missing = [key for key in REQUIRED if not os.environ.get(key, '').strip()]
    if missing:
        raise SystemExit('Telegram Sync: configure ' + ', '.join(missing))
    try:
        if int(os.environ['TELEGRAM_API_ID']) <= 0:
            raise ValueError()
        Fernet(os.environ['TELEGRAM_ENCRYPTION_KEY'].encode())
    except (ValueError, TypeError):
        raise SystemExit('Telegram Sync: API ID ou chave de criptografia inválidos.') from None


def validate_database():
    try:
        with psycopg.connect(os.environ['TELEGRAM_DATABASE_URL'], connect_timeout=10) as conn:
            with conn.cursor() as cursor:
                cursor.execute("select to_regclass('public.tg_connections'), to_regclass('public.tg_sync_jobs'), to_regclass('public.tg_message_map'), to_regclass('public.tg_audit_logs')")
                if not all(cursor.fetchone()):
                    raise SystemExit('Telegram Sync: aplique a migração do banco antes de iniciar.')
    except psycopg.Error:
        raise SystemExit('Telegram Sync: banco indisponível; confira conexão, TLS e permissões.') from None


def prepare():
    validate_environment()
    validate_database()
