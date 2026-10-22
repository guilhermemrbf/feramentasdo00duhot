"""Run locally on a trusted device; never send OTP/2FA credentials to the web app."""
import asyncio
import os
from telethon import TelegramClient
from telethon.sessions import StringSession

async def main():
    async with TelegramClient(StringSession(),int(os.environ['TELEGRAM_API_ID']),os.environ['TELEGRAM_API_HASH']) as tg:
        print('Sessão secreta: cole somente no campo protegido do Telegram Sync.')
        print(tg.session.save())

asyncio.run(main())
