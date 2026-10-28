"""Bounded selection for the native Telegram forwarding action."""
from telethon import types
from .domain import UserError


async def latest_selection(messages, limit=100):
    """Read newest first; stop before the first complete album that cannot fit."""
    selected, group = [], []
    async for message in messages:
        if isinstance(message, (types.MessageService, types.MessageEmpty)):
            continue
        if group and not (message.grouped_id and message.grouped_id == group[0].grouped_id):
            if len(selected) + len(group) > limit:
                break
            selected.extend(group)
            if len(selected) == limit:
                break
            group = []
        group.append(message)
        if len(group) > limit:
            raise UserError('Um álbum ultrapassa o limite de 100 mensagens. Nenhuma cópia foi criada.')
    else:
        if len(selected) + len(group) <= limit:
            selected.extend(group)
    return sorted(selected, key=lambda message: message.id)
