import asyncio
import base64
import io
import time
import unittest
from unittest.mock import AsyncMock, Mock, patch
import json

import av
from PIL import Image
from pymobiledevice3.remote.core_device.screen_stream import ScreenStreamServer

from capture import capture_mode, CaptureError
from controls import InputChannel, back_swipe, fit_image_size, key_usage, touch_position
from live_video import DecodeInbox, Decoder, Packets, ViewOnlyStream
from render import LatestFrameRenderer


class CaptureTests(unittest.TestCase):
    def test_previously_seen_devices_use_different_capture_paths(self):
        self.assertEqual(capture_mode("26.6.1"), "snapshots")
        self.assertEqual(capture_mode("27.2"), "live")
        with self.assertRaises(CaptureError):
            capture_mode("17.3")

    def test_pointer_hits_only_the_image_and_reverses_rotation(self):
        bounds = (100, 50, 300, 450)
        self.assertIsNone(touch_position(90, 60, bounds, 0))
        self.assertEqual(touch_position(100, 50, bounds, 0), (0, 0))
        self.assertEqual(touch_position(100, 50, bounds, 90), (0, 65535))
        self.assertEqual(touch_position(100, 50, bounds, 180), (65535, 65535))
        self.assertEqual(touch_position(100, 50, bounds, 270), (65535, 0))
        self.assertEqual(touch_position(900, 800, bounds, 270, clamp=True), (0, 65535))

    def test_keyboard_translates_windows_events_to_hid(self):
        self.assertEqual(key_usage("A", 0x41, "A"), 4)
        self.assertEqual(key_usage("quotedbl", char='"'), 0x34)
        self.assertEqual(key_usage("bar", char="|"), 0x31)
        self.assertEqual(key_usage("Return"), 0x28)
        self.assertEqual(key_usage("Down"), 0x51)

    def test_back_swipe_starts_at_left_edge_in_view_coordinates(self):
        self.assertEqual(back_swipe(0), (66, 32768, 28835, 32768))
        self.assertEqual(back_swipe(90), (32768, 65469, 32768, 36700))

    def test_viewport_enlarges_images_without_stretching_in_both_orientations(self):
        self.assertEqual(fit_image_size((360, 800), (1600, 1000)), (450, 1000))
        self.assertEqual(fit_image_size((800, 360), (1600, 1000)), (1600, 720))
        self.assertEqual(fit_image_size((800, 360), (400, 150)), (333, 150))
        self.assertEqual(touch_position(800, 500, (575, 0, 1025, 1000), 0), (32768, 32768))


class InputTests(unittest.IsolatedAsyncioTestCase):
    async def test_decode_backlog_skips_deltas_until_reset_keyframe(self):
        inbox = DecodeInbox(max_pending=4)
        inbox.push(3, b"codec")
        inbox.push(4, b"rotate")
        inbox.push(1, b"old A")
        inbox.push(1, b"old B")
        self.assertTrue(inbox.push(1, b"overflow"))
        inbox.push(1, b"discarded delta")
        inbox.push(0, b"fresh key")
        inbox.push(1, b"next delta")
        self.assertEqual([await inbox.get() for _ in range(4)],
                         [(3, b"codec"), (4, b"rotate"), (2, b"fresh key"), (1, b"next delta")])

    async def test_mouse_motion_coalesces_without_dropping_press_or_release(self):
        channel = InputChannel(Mock(), Mock())
        channel.enqueue("touch", ("contact", 100, 100))
        for number in range(1, 100):
            channel.enqueue("move", (number, number))
        channel.enqueue("touch", ("release", 100, 100))
        self.assertEqual(channel.queue.qsize(), 3)
        self.assertEqual([await channel.queue.get() for _ in range(3)], [
            ["touch", ("contact", 100, 100)], ["move", (99, 99)], ["touch", ("release", 100, 100)],
        ])
    async def test_fast_mouse_click_has_enough_contact_time(self):
        times = []

        async def send(body):
            times.append((json.loads(body)["type"], time.perf_counter()))
            return 200, b"ok"

        channel = InputChannel(Mock(_handle_touch=send), Mock())
        await channel.send_touch("contact", 500, 700)
        await channel.send_touch("release", 500, 700)
        self.assertEqual([kind for kind, _ in times], ["contact", "release"])
        self.assertGreaterEqual(times[1][1] - times[0][1], 0.055)

    async def test_fast_drag_keeps_motion_before_lifting(self):
        reports = []

        async def send(body):
            reports.append((json.loads(body), time.perf_counter()))
            return 200, b"ok"

        channel = InputChannel(Mock(_handle_touch=send), Mock())
        await channel.send_touch("contact", 100, 200)
        await channel.dispatch("finish-touch", (500, 600))
        self.assertEqual([(r["type"], r["x"], r["y"]) for r, _ in reports], [
            ("contact", 100, 200), ("contact", 300, 400),
            ("contact", 500, 600), ("release", 500, 600),
        ])
        self.assertGreaterEqual(reports[-1][1] - reports[-2][1], 0.030)

    async def test_back_uses_a_continuous_left_edge_swipe(self):
        server = Mock(_handle_touch=AsyncMock(return_value=(200, b"ok")))
        channel = InputChannel(server, Mock())
        await channel.dispatch("back", back_swipe(0))
        samples = [json.loads(call.args[0]) for call in server._handle_touch.await_args_list]
        self.assertEqual(len(samples), 8)
        self.assertEqual(samples[0], {"type": "contact", "x": 66, "y": 32768})
        self.assertEqual(samples[-1], {"type": "release", "x": 28835, "y": 32768})
        self.assertEqual(sorted(sample["x"] for sample in samples), [sample["x"] for sample in samples])

    async def test_gesture_and_keys_release_when_worker_is_cancelled(self):
        server = Mock(
            _handle_touch=AsyncMock(return_value=(200, b"ok")),
            _handle_key=AsyncMock(return_value=(200, b"ok")),
        )
        channel = InputChannel(server, Mock())
        worker = asyncio.create_task(channel.run())
        channel.post("touch", "contact", 300, 500)
        channel.post("keys", (4,))
        async with asyncio.timeout(2):
            while channel.keys != (4,):
                await asyncio.sleep(0.01)
        worker.cancel()
        await asyncio.gather(worker, return_exceptions=True)
        self.assertEqual(json.loads(server._handle_touch.await_args.args[0]), {"type": "release", "x": 300, "y": 500})
        self.assertEqual(json.loads(server._handle_key.await_args.args[0]), {"usages": []})

    async def test_explicit_paste_sends_unicode_then_command_v(self):
        server = Mock(_clipboard_set=AsyncMock(), _handle_key=AsyncMock(return_value=(200, b"ok")))
        channel = InputChannel(server, Mock())
        await channel.dispatch("paste", ("Olá, São Paulo",))
        server._clipboard_set.assert_awaited_once_with(text="Olá, São Paulo")
        keys = [json.loads(call.args[0])["usages"] for call in server._handle_key.await_args_list]
        self.assertEqual(keys, [[0xE3, 0x19], []])

    def test_packet_framing_survives_fragmentation(self):
        parser = Packets()
        frame = b"\x00\x00\x00\x05\x01abcd"
        self.assertEqual(list(parser.feed(frame[:5])), [])
        self.assertEqual(list(parser.feed(frame[5:] + frame)), [(1, b"abcd"), (1, b"abcd")])
        self.assertFalse(parser.buffer)
        with self.assertRaises(ValueError):
            list(parser.feed(b"\xff\xff\xff\xff"))

    def test_decoder_displays_a_real_hevc_frame_and_applies_rotation(self):
        media = io.BytesIO()
        with av.open(media, "w", format="mp4") as output:
            stream = output.add_stream("libx265", rate=30, options={
                "tune": "zerolatency", "x265-params": "log-level=error:pools=none:frame-threads=1",
            })
            stream.width, stream.height, stream.pix_fmt = 96, 64, "yuv420p"
            image = av.VideoFrame.from_image(Image.new("RGB", (96, 64), "red"))
            for packet in stream.encode(image) + stream.encode(None):
                output.mux(packet)
        media.seek(0)
        with av.open(media, "r") as source:
            codec = source.streams.video[0].codec_context
            decoder = Decoder({
                "description": base64.b64encode(codec.extradata).decode(),
                "display": {"rotation": 90},
            })
            packet = next(packet for packet in source.demux(video=0) if packet.size)
            images = list(decoder.decode(0, bytes(packet)))
            self.assertEqual(len(images), 1)
            self.assertEqual(images[0].size, (64, 96))
            self.assertGreater(images[0].getpixel((20, 20))[0], 200)


class ViewOnlyTests(unittest.IsolatedAsyncioTestCase):
    async def test_internal_web_listener_only_exposes_video(self):
        server = object.__new__(ViewOnlyStream)
        for method in [b"GET /clipboard", b"POST /touch", b"POST /stream.bin", b"GET /codec"]:
            reader = asyncio.StreamReader()
            reader.feed_data(method + b" HTTP/1.1\r\n\r\n")
            writer = Mock(drain=AsyncMock())
            with patch.object(ScreenStreamServer, "_serve_connection", new_callable=AsyncMock) as route:
                await server._serve_connection(reader, writer)
            if method == b"GET /codec":
                route.assert_awaited_once()
                request = await route.call_args.args[0].readline()
                self.assertEqual(request, b"GET /codec HTTP/1.1\r\n")
            else:
                route.assert_not_awaited()
                self.assertIn(b"404", writer.write.call_args.args[0])


class FrameRendererTests(unittest.TestCase):
    def test_latest_frame_is_fitted_to_current_viewport(self):
        renderer = LatestFrameRenderer()
        try:
            renderer.resize(70, 140)
            renderer.publish(Image.new("RGB", (100, 200), "red"), 0)
            renderer.resize(180, 160)
            renderer.publish(Image.new("RGB", (100, 200), "blue"), 90)
            deadline = time.monotonic() + 1
            while time.monotonic() < deadline:
                result = renderer.take()
                if result is not None and result[1] == 90:
                    self.assertEqual(result[0].size, (80, 160))
                    self.assertEqual(result[0].getpixel((2, 2)), (0, 0, 255))
                    break
                time.sleep(0.005)
            else:
                self.fail("Latest frame was not rendered")
        finally:
            renderer.close()


if __name__ == "__main__":
    unittest.main()
