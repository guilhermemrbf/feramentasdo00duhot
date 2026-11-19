import asyncio
import base64
import json
import secrets
import socket
import time
from collections import deque

import av
import httpx
from pymobiledevice3.remote.core_device.screen_stream import ScreenStreamServer
from controls import InputChannel

MAX_PACKET = 16 * 1024 * 1024


class _FirstLine:
    def __init__(self, line, reader):
        self.line = line
        self.reader = reader

    async def readline(self):
        if self.line:
            line, self.line = self.line, None
            return line
        return await self.reader.readline()


class ViewOnlyStream(ScreenStreamServer):
    """Expose only video and its codec metadata to the native local viewer."""

    async def _serve_connection(self, reader, writer):
        async with asyncio.timeout(5):
            line = await reader.readline()
        parts = line.split()
        if len(parts) != 3 or parts[0] != b"GET" or parts[1] not in (b"/codec", b"/stream.bin"):
            writer.write(b"HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
            await writer.drain()
            return
        await super()._serve_connection(_FirstLine(line, reader), writer)


class Packets:
    """Read length-prefixed messages regardless of HTTP chunk boundaries."""

    def __init__(self):
        self.buffer = bytearray()

    def feed(self, chunk):
        self.buffer.extend(chunk)
        offset = 0
        while len(self.buffer) - offset >= 4:
            length = int.from_bytes(self.buffer[offset:offset + 4], "big")
            if not 1 <= length <= MAX_PACKET:
                raise ValueError("Quadro de vídeo inválido.")
            end = offset + length + 4
            if end > len(self.buffer):
                break
            yield self.buffer[offset + 4], bytes(self.buffer[offset + 5:end])
            offset = end
        if offset:
            del self.buffer[:offset]


class DecodeInbox:
    """Limit queued video and recover on a fresh keyframe after overload."""

    def __init__(self, max_pending=12):
        self.messages = deque()
        self.wakeup = asyncio.Event()
        self.max_pending = max_pending
        self.config = self.rotation = None
        self.waiting_key = False

    def push(self, kind, payload):
        if kind == 3:
            self.config, self.rotation = payload, None
        elif kind == 4:
            self.rotation = payload
        overflow = len(self.messages) >= self.max_pending
        if overflow:
            self.messages.clear()
            self.waiting_key = True
            if self.config is not None:
                self.messages.append((3, self.config))
            if self.rotation is not None:
                self.messages.append((4, self.rotation))
        if self.waiting_key:
            if kind in (0, 2):
                self.messages.append((2, payload))
                self.waiting_key = False
            elif kind in (3, 4) and not overflow:
                self.messages.append((kind, payload))
        elif not overflow:
            self.messages.append((kind, payload))
        if self.messages:
            self.wakeup.set()
        return overflow and self.waiting_key

    async def get(self):
        while not self.messages:
            self.wakeup.clear()
            await self.wakeup.wait()
        return self.messages.popleft()


class Decoder:
    def __init__(self, config):
        self.config = config
        self.rotation = config.get("display", {}).get("rotation", 0)
        self.last_render = 0.0
        self.reset()

    def reset(self):
        self.codec = av.CodecContext.create("hevc", "r")
        self.codec.thread_type = "SLICE"
        self.codec.thread_count = 2
        self.codec.extradata = base64.b64decode(self.config["description"], validate=True)
        self.codec.open()
        self.needs_key = True

    def decode(self, kind, payload):
        if kind == 3:
            self.config = json.loads(payload)
            self.rotation = self.config.get("display", {}).get("rotation", self.rotation)
            self.reset()
            return
        if kind == 4:
            self.rotation = json.loads(payload).get("rotation", self.rotation)
            return
        if kind not in (0, 1, 2) or (kind == 1 and self.needs_key):
            return
        if kind == 2:
            self.reset()
        try:
            frames = self.codec.decode(av.Packet(payload))
        except av.error.InvalidDataError:
            self.reset()
            return
        self.needs_key = False
        for frame in frames:
            now = time.monotonic()
            if now - self.last_render < 1 / 30:
                continue
            # Scaling before converting avoids copying full-resolution RGB frames.
            scale = min(1.0, 1100 / max(frame.width, frame.height))
            image = frame.reformat(
                width=max(1, round(frame.width * scale)),
                height=max(1, round(frame.height * scale)),
                format="rgb24",
            ).to_image()
            self.rendered_rotation = self.rotation if self.rotation in (90, 180, 270) else 0
            display = self.config.get("display", {})
            if self.rendered_rotation in (90, 270) and display.get("width") and display.get("height"):
                # An already rotated stream must not be rotated again by the viewer.
                if (display["width"] > display["height"]) != (frame.width > frame.height):
                    self.rendered_rotation = 0
            if self.rendered_rotation:
                image = image.rotate(-self.rendered_rotation, expand=True)
            self.last_render = now
            yield image

    def latest(self, kind, payload):
        rendered = None
        for image in self.decode(kind, payload):
            rendered = (image, self.rendered_rotation)
        return rendered


async def stream_video(rsd, show, on_input, on_input_error):
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    password = secrets.token_urlsafe(32)
    server = ViewOnlyStream(rsd, bind="127.0.0.1", http_port=port, password=password, audio_default_on=False)
    task = asyncio.create_task(server.serve())
    channel = InputChannel(server, on_input_error)
    controls = asyncio.create_task(channel.run())
    ready = False
    try:
        url = f"http://127.0.0.1:{port}"
        async with httpx.AsyncClient(base_url=url, auth=("viewer", password), timeout=12, trust_env=False) as client:
            async with asyncio.timeout(65):
                while True:
                    if task.done():
                        await task
                        raise RuntimeError("O serviço de vídeo encerrou.")
                    try:
                        response = await client.get("/codec")
                        if response.is_success:
                            decoder = Decoder(response.json())
                            break
                    except httpx.TransportError:
                        pass
                    await asyncio.sleep(0.8)
            packets = Packets()
            async with client.stream("GET", "/stream.bin", timeout=httpx.Timeout(55, connect=5)) as response:
                response.raise_for_status()
                inbox = DecodeInbox()

                async def receive():
                    async for chunk in response.aiter_bytes():
                        for kind, payload in packets.feed(chunk):
                            if inbox.push(kind, payload):
                                server._request_recovery_idr(reason="native-viewer-backlog")

                async def decode():
                    nonlocal ready
                    while True:
                        kind, payload = await inbox.get()
                        rendered = await asyncio.to_thread(decoder.latest, kind, payload)
                        if rendered is not None:
                            if not ready:
                                on_input(channel)
                                ready = True
                            show(*rendered)

                readers = (asyncio.create_task(receive()), asyncio.create_task(decode()))
                try:
                    done, _ = await asyncio.wait(readers, return_when=asyncio.FIRST_COMPLETED)
                    for completed in done:
                        await completed
                finally:
                    for reader in readers:
                        reader.cancel()
                    await asyncio.gather(*readers, return_exceptions=True)
            if task.done():
                await task
            raise RuntimeError("O iPhone interrompeu a transmissão.")
    finally:
        channel.active = False
        on_input(None)
        controls.cancel()
        await asyncio.gather(controls, return_exceptions=True)
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
