import asyncio
import queue
import threading
from .engine import Engine, safe_error

class Runtime:
    def __init__(self, store):
        self.events = queue.Queue()
        self.loop = asyncio.new_event_loop()
        self.engine = Engine(store,lambda kind,value: self.events.put((kind,value,None)))
        self.thread = threading.Thread(target=self._run,daemon=True,name='TelegramSync')
        self.thread.start()
        self.closed = False

    def _run(self):
        asyncio.set_event_loop(self.loop)
        self.worker = self.loop.create_task(self.engine.run())
        self.loop.run_forever()
        self.loop.close()

    def submit(self, coroutine, callback=None):
        future = asyncio.run_coroutine_threadsafe(coroutine,self.loop)
        def done(result):
            try:
                value = result.result()
                self.events.put(('result',value,callback))
            except Exception as reason:
                self.events.put(('error',safe_error(reason),callback))
        future.add_done_callback(done)

    def close(self):
        if self.closed:
            return
        self.closed = True
        async def stop():
            self.engine.stopping = True
            self.worker.cancel()
            try:
                await self.worker
            except asyncio.CancelledError:
                pass
            # Any interrupted publication remains 'sending' for review at next startup.
            try:
                await asyncio.wait_for(self.engine.shutdown(),timeout=5)
            except (Exception,asyncio.CancelledError):
                pass
            current = asyncio.current_task()
            pending = [task for task in asyncio.all_tasks() if task is not current and not task.done()]
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending,return_exceptions=True)
            self.loop.call_soon(self.loop.stop)
        asyncio.run_coroutine_threadsafe(stop(),self.loop)
