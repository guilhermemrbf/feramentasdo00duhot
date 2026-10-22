import os
import sys
import tempfile
from pathlib import Path

VERSION = '0.1.1'


def data_directory():
    base = Path(os.environ.get('LOCALAPPDATA',str(Path.home()/'.local'/'share')))
    return base/'00duHot'/'TelegramSync'


class SingleInstance:
    def __init__(self, directory):
        directory.mkdir(parents=True,exist_ok=True)
        self.handle=open(directory/'application.lock','a+b')
        self.handle.seek(0);self.handle.write(b'0');self.handle.flush();self.handle.seek(0)
        try:
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(self.handle.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(self.handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:
            self.handle.close()
            raise RuntimeError('O Telegram Sync já está aberto neste computador.') from None

    def close(self):
        self.handle.close()


def self_test():
    from local_app.store import Store
    from local_app.domain import replace
    from local_app.ui import Window
    import tkinter as tk
    with tempfile.TemporaryDirectory() as directory:
        store=Store(Path(directory)/'test.sqlite3')
        job=store.create('1','2','Origem','Destino','history',[],0)
        assert store.job(job)['status']=='paused'
        assert replace('hello old',[{'find':'old','replacement':'new'}])=='hello new'
        if os.name=='nt':
            from local_app.secrets import protect,unprotect
            assert unprotect(protect('desktop-self-test'))=='desktop-self-test'
        root=tk.Tk();root.withdraw()
        window=Window(root,store)
        root.update()
        window.closing=True
        window.runtime.close()
        window.runtime.thread.join(timeout=10)
        assert not window.runtime.thread.is_alive()
        store.close()
        root.destroy()


def main():
    if '--version' in sys.argv:
        return 0
    if '--self-test' in sys.argv:
        self_test()
        return 0
    import tkinter as tk
    from tkinter import messagebox
    from local_app.store import Store
    from local_app.ui import Window
    root=tk.Tk()
    instance=None
    try:
        instance=SingleInstance(data_directory())
        store=Store(data_directory()/'telegram-sync.sqlite3')
        Window(root,store)
        root.mainloop()
    except RuntimeError as reason:
        messagebox.showerror('Telegram Sync',str(reason),parent=root)
        root.destroy()
        return 1
    finally:
        if instance:instance.close()
    return 0


if __name__=='__main__':
    try:
        sys.exit(main())
    except Exception:
        # Never print raw exceptions: they may contain auth values or message contents.
        sys.exit(1)
