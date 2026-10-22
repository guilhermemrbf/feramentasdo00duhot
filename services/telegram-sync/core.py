import re
from urllib.parse import urlparse


def channel_ref(value: str):
    value = value.strip()
    if re.fullmatch(r'-?\d+', value):
        number = int(value)
        if number == 0:
            raise ValueError('ID inválido.')
        return number
    if value.startswith(('https://', 'http://')):
        url = urlparse(value)
        if url.hostname not in ('t.me', 'telegram.me') or url.query or url.fragment:
            raise ValueError('Use um link de canal do Telegram.')
        value = url.path.strip('/')
    value = value.removeprefix('@')
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{3,31}', value):
        raise ValueError('Use ID, @username ou link público; para privados, use o ID de um canal já acessível na conta.')
    return value


def replace(text, rules):
    # Simultaneous literal replacements prevent cascading rules and regex injection.
    mapping = {r['find']: r['replacement'] for r in rules}
    if not mapping:
        return text or ''
    pattern = '|'.join(re.escape(x) for x in sorted(mapping, key=len, reverse=True))
    return re.sub(pattern, lambda m: mapping[m.group()], text or '')
