import os
import sys
import tempfile
from pathlib import Path

VERSION = '0.5.1'


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
        assert window.brand_mark.width()>0
        # Exercise the editor widgets in the packaged Windows application.
        from local_app.editor import DEFAULT_URL, rewrite, encode_entities
        from telethon import types
        original={'text':'VIP','entities':encode_entities([types.MessageEntityTextUrl(0,3,'https://old.example')]),'media':None,'preview':False,'buttons':None}
        desired,links=rewrite(original,DEFAULT_URL)
        batch=window.runtime.engine.editor.db.create('-100123','Canal de teste',1,DEFAULT_URL)
        window.runtime.engine.editor.db.add(batch,7,original,desired,links)
        window.runtime.engine.editor.db.patch(batch,status='ready',note='Prévia de teste')
        window.editor_tab.complete(batch)
        window.show_operation('edit')
        root.deiconify()
        root.update()
        window.editor_tab.tree.selection_set('7')
        window.editor_tab.details()
        root.update()
        assert DEFAULT_URL in window.editor_tab.detail.get('1.0','end')
        assert window.editor_tab.detail.winfo_height() >= 40
        assert window.editor_tab.tree.winfo_height() >= 40
        if os.name=='nt' and os.environ.get('TELEGRAM_SYNC_UI_PREVIEW')=='1':
            # CI-only screenshots of this temporary fixture; never a real account.
            import subprocess
            destination=Path('dist');destination.mkdir(exist_ok=True)
            for page in ('home','tasks','editor'):
                window.navigate(page);root.update()
                path=str((destination/('ui-'+page+'.png')).resolve()).replace("'","''")
                script=("Add-Type -AssemblyName System.Drawing; "
                    f"$image=New-Object System.Drawing.Bitmap({root.winfo_width()},{root.winfo_height()}); "
                    "$graphics=[System.Drawing.Graphics]::FromImage($image); "
                    f"$graphics.CopyFromScreen({root.winfo_rootx()},{root.winfo_rooty()},0,0,$image.Size); "
                    f"$image.Save('{path}',[System.Drawing.Imaging.ImageFormat]::Png); "
                    "$graphics.Dispose(); $image.Dispose()")
                subprocess.run(['powershell','-NoProfile','-NonInteractive','-Command',script],check=True,timeout=30)
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
