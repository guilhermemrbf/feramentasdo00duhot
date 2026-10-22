import re
from urllib.parse import urlparse

class UserError(Exception):
    """Only these reviewed messages may be shown in the UI."""


def channel_ref(value):
    value = value.strip()
    if re.fullmatch(r'-?\d+', value):
        if int(value) == 0:
            raise UserError('ID de canal inválido.')
        return int(value)
    if value.startswith(('https://', 'http://')):
        url = urlparse(value)
        if url.hostname not in ('t.me', 'telegram.me') or url.query or url.fragment:
            raise UserError('Use um link público do Telegram, @username ou ID.')
        value = url.path.strip('/')
    value = value.removeprefix('@')
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{3,31}', value):
        raise UserError('Use @username, link público ou ID. Para canais privados, use o ID de um canal do qual já participa.')
    return value


def validate_rules(rules):
    if not isinstance(rules, list) or len(rules) > 50:
        raise UserError('Use no máximo 50 regras.')
    result = []
    seen = set()
    for rule in rules:
        if not isinstance(rule, dict) or not isinstance(rule.get('find'), str) or not isinstance(rule.get('replacement'), str):
            raise UserError('Cada regra deve conter os textos original e substituto.')
        find, replacement = rule['find'], rule['replacement']
        if not find or max(len(find), len(replacement)) > 2048 or find in seen:
            raise UserError('Preencha o texto original sem repetir regras, com até 2.048 caracteres por campo.')
        seen.add(find)
        result.append({'find': find, 'replacement': replacement})
    return result


def replace(text, rules):
    mapping = {r['find']: r['replacement'] for r in validate_rules(rules)}
    if not mapping:
        return text or ''
    pattern = '|'.join(re.escape(x) for x in sorted(mapping, key=len, reverse=True))
    return re.sub(pattern, lambda m: mapping[m.group()], text or '')


def caption(message, rules):
    from telethon import types
    text = message.message or ''
    # Telegram entity offsets count UTF-16 code units, not Python characters.
    entities = sorted(message.get_entities_text(), key=lambda pair: pair[0].offset, reverse=True)
    for entity, label in entities:
        if isinstance(entity, types.MessageEntityTextUrl):
            raw = text.encode('utf-16-le')
            start, end = entity.offset * 2, (entity.offset + entity.length) * 2
            text = (raw[:start] + f'{label} ({entity.url})'.encode('utf-16-le') + raw[end:]).decode('utf-16-le')
    return replace(text, rules)


def media_batches(messages):
    result = []
    for message in messages:
        if result and message.grouped_id and result[-1][0].grouped_id == message.grouped_id:
            result[-1].append(message)
        else:
            result.append([message])
    return result
