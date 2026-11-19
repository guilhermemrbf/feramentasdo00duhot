from threading import Condition, Thread

from PIL import Image
from controls import fit_image_size


class LatestFrameRenderer:
    """Resize the latest frame off the Tk thread, with one slot on either side."""

    def __init__(self):
        self.condition = Condition()
        self.viewport = (1, 1)
        self.layout_revision = 0
        self.source = self.ready = None
        self.pending = self.closed = False
        Thread(target=self._render, daemon=True, name="phone-frame-renderer").start()

    def publish(self, frame, rotation):
        with self.condition:
            self.source = (frame, rotation)
            self.pending = True
            self.condition.notify()

    def resize(self, width, height):
        with self.condition:
            self.viewport = (max(1, width), max(1, height))
            self.layout_revision += 1
            self.ready = None
            self.pending = self.source is not None
            self.condition.notify()

    def clear(self):
        with self.condition:
            self.layout_revision += 1
            self.source = self.ready = None
            self.pending = False

    def take(self):
        with self.condition:
            ready, self.ready = self.ready, None
            return ready

    def close(self):
        with self.condition:
            self.closed = True
            self.source = self.ready = None
            self.condition.notify()

    def _render(self):
        while True:
            with self.condition:
                self.condition.wait_for(lambda: self.pending or self.closed)
                if self.closed:
                    return
                frame, rotation = self.source
                viewport, revision = self.viewport, self.layout_revision
                self.pending = False
            size = fit_image_size(frame.size, viewport)
            if frame.size != size:
                frame = frame.resize(size, Image.Resampling.BILINEAR)
            with self.condition:
                if not self.closed and revision == self.layout_revision:
                    self.ready = (frame, rotation)
