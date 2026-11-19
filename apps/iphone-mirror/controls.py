import asyncio
import json
from contextlib import suppress


def fit_image_size(original, viewport):
    width, height = original
    scale = min(viewport[0] / width, viewport[1] / height)
    return max(1, round(width * scale)), max(1, round(height * scale))


def touch_position(x, y, bounds, rotation, clamp=False):
    left, top, right, bottom = bounds
    if right <= left or bottom <= top:
        return None
    if not clamp and not (left <= x <= right and top <= y <= bottom):
        return None
    x = max(0, min(1, (x - left) / (right - left)))
    y = max(0, min(1, (y - top) / (bottom - top)))
    if rotation == 90:
        x, y = y, 1 - x
    elif rotation == 180:
        x, y = 1 - x, 1 - y
    elif rotation == 270:
        x, y = 1 - y, x
    return round(x * 65535), round(y * 65535)


def back_swipe(rotation):
    start, end = (1, 500), (440, 500)
    screen = (0, 0, 1000, 1000)
    return (*touch_position(*start, screen, rotation), *touch_position(*end, screen, rotation))


_KEYS = {
    "Return": 0x28, "KP_Enter": 0x58, "Escape": 0x29, "BackSpace": 0x2A,
    "Tab": 0x2B, "space": 0x2C, "minus": 0x2D, "equal": 0x2E,
    "bracketleft": 0x2F, "bracketright": 0x30, "backslash": 0x31,
    "semicolon": 0x33, "apostrophe": 0x34, "grave": 0x35, "comma": 0x36,
    "period": 0x37, "slash": 0x38, "Caps_Lock": 0x39, "Delete": 0x4C,
    "Home": 0x4A, "End": 0x4D, "Right": 0x4F, "Left": 0x50, "Down": 0x51, "Up": 0x52,
    "Shift_L": 0xE1, "Shift_R": 0xE5, "Control_L": 0xE0, "Control_R": 0xE4,
    "Alt_L": 0xE2, "Alt_R": 0xE6,
}
_SHIFTED = dict(zip('!@#$%^&*()_+{}|:"~<>?', "1234567890-=[]\\;'`,./", strict=True))
_PUNCTUATION = dict(zip("-=[]\\;'`,./", (
    "minus", "equal", "bracketleft", "bracketright", "backslash", "semicolon",
    "apostrophe", "grave", "comma", "period", "slash",
), strict=True))


def key_usage(keysym, keycode=0, char=""):
    if 0x41 <= keycode <= 0x5A:
        return 4 + keycode - 0x41
    if 0x30 <= keycode <= 0x39:
        return 0x27 if keycode == 0x30 else 0x1E + keycode - 0x31
    symbol = _SHIFTED.get(char, keysym)
    return _KEYS.get(_PUNCTUATION.get(symbol, symbol))


class InputChannel:
    def __init__(self, server, on_error):
        self.server = server
        self.on_error = on_error
        self.loop = asyncio.get_running_loop()
        self.queue = asyncio.Queue(maxsize=128)
        self.pending_move = None
        self.active = True
        self.touch = None
        self.contact_started = None
        self.last_motion_sent = None
        self.keys = ()

    def post(self, event, *args):
        with suppress(RuntimeError):
            self.loop.call_soon_threadsafe(self.enqueue, event, args)

    def enqueue(self, event, args):
        if not self.active:
            return
        if event == "move" and self.pending_move is not None:
            self.pending_move[1] = args
            return
        item = [event, args]
        self.pending_move = item if event == "move" else None
        try:
            self.queue.put_nowait(item)
        except asyncio.QueueFull:
            # Drop the backlog instead of replaying old clicks or holding a finger down.
            while not self.queue.empty():
                self.queue.get_nowait()
            self.pending_move = None
            self.queue.put_nowait(("release", ()))
            self.on_error("O iPhone demorou para receber os comandos. Tente o gesto novamente.")

    async def send(self, handler, payload):
        code, _ = await handler(json.dumps(payload).encode())
        if code != 200:
            raise RuntimeError("O iPhone recusou o comando de controle.")

    async def send_touch(self, kind, x, y):
        new_contact = kind == "contact" and self.touch is None
        moved = kind == "contact" and not new_contact and self.touch != (x, y)
        if kind == "contact":
            self.touch = (x, y)
        elif kind == "release" and self.contact_started is not None:
            release_at = self.contact_started + 0.055
            if self.last_motion_sent is not None:
                release_at = max(release_at, self.last_motion_sent + 0.030)
            await asyncio.sleep(max(0, release_at - self.loop.time()))
        await self.send(self.server._handle_touch, {"type": kind, "x": x, "y": y})
        if new_contact:
            self.contact_started = self.loop.time()
        if moved:
            self.last_motion_sent = self.loop.time()
        if kind == "release":
            self.touch = None
            self.contact_started = None
            self.last_motion_sent = None

    async def finish_touch(self, x, y):
        if self.touch is None:
            return
        if self.touch != (x, y):
            if self.last_motion_sent is None:
                # Windows can deliver a short drag as just press and release.
                # Preserve the gesture even if no intermediate sample reached the device.
                await asyncio.sleep(max(0, self.contact_started + 0.025 - self.loop.time()))
                start_x, start_y = self.touch
                await self.send_touch("contact", round((start_x + x) / 2), round((start_y + y) / 2))
                await asyncio.sleep(0.025)
            await self.send_touch("contact", x, y)
        await self.send_touch("release", x, y)

    async def send_keys(self, keys):
        if keys:
            self.keys = keys
        await self.send(self.server._handle_key, {"usages": keys})
        self.keys = keys

    async def release(self):
        if self.touch is not None:
            with suppress(Exception):
                await asyncio.wait_for(self.send_touch("release", *self.touch), 2)
        if self.keys:
            with suppress(Exception):
                await asyncio.wait_for(self.send_keys(()), 2)

    async def dispatch(self, event, args):
        if event == "touch":
            await self.send_touch(*args)
        elif event == "move" and self.touch is not None:
            await self.send_touch("contact", *args)
        elif event == "finish-touch":
            await self.finish_touch(*args)
        elif event == "keys":
            await self.send_keys(*args)
        elif event == "button":
            await self.send(self.server._handle_button, {"name": args[0], "state": "press"})
        elif event == "paste":
            await self.server._clipboard_set(text=args[0])
            await self.send_keys((0xE3, 0x19))
            await asyncio.sleep(0.06)
            await self.send_keys(())
        elif event in ("scroll", "back"):
            x, y, end_x, end_y = args
            interval = 0.035 if event == "back" else 0.018
            await self.send_touch("contact", x, y)
            for n in range(1, 7):
                await asyncio.sleep(interval)
                await self.send_touch("contact", round(x + (end_x - x) * n / 6), round(y + (end_y - y) * n / 6))
            await self.send_touch("release", end_x, end_y)
        elif event == "release":
            await self.release()

    async def run(self):
        try:
            while True:
                item = await self.queue.get()
                if item is self.pending_move:
                    self.pending_move = None
                event, args = item
                try:
                    await asyncio.wait_for(self.dispatch(event, args), 8)
                except Exception:
                    self.on_error("O iPhone não recebeu o último comando. Mantenha-o desbloqueado e tente novamente.")
                    await self.release()
        finally:
            self.active = False
            await self.release()
