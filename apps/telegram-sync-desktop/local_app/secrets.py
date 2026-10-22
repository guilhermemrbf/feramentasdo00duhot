"""Windows DPAPI. No raw session files, application-wide key or third-party vault."""
import base64
import ctypes
import os
from ctypes import wintypes
from .domain import UserError

class Blob(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_byte))]


def _transform(value, decrypt=False):
    if os.name != 'nt':
        raise UserError('Esta versão protege contas com o Windows. Execute no Windows 10 ou 11.')
    buffer = ctypes.create_string_buffer(value)
    source = Blob(len(value), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte)))
    output = Blob()
    crypt = ctypes.WinDLL('crypt32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    # CRYPTPROTECT_UI_FORBIDDEN; scope defaults to the current Windows user.
    if decrypt:
        function = crypt.CryptUnprotectData
        function.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
        ok = function(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(output))
    else:
        function = crypt.CryptProtectData
        function.argtypes = [ctypes.POINTER(Blob), wintypes.LPCWSTR, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
        ok = function(ctypes.byref(source), 'Telegram Sync', None, None, None, 1, ctypes.byref(output))
    if not ok:
        raise UserError('O Windows não conseguiu proteger ou abrir esta conta. Conecte novamente neste usuário do Windows.')
    try:
        return ctypes.string_at(output.data, output.size)
    finally:
        kernel.LocalFree(ctypes.cast(output.data, ctypes.c_void_p))


def protect(text):
    return 'dpapi:' + base64.b64encode(_transform(text.encode())).decode('ascii')


def unprotect(text):
    if not text.startswith('dpapi:'):
        raise UserError('Formato de credencial local inválido.')
    try:
        return _transform(base64.b64decode(text[6:], validate=True), decrypt=True).decode()
    except (ValueError, UnicodeError):
        raise UserError('Credencial local inválida. Conecte novamente.') from None
