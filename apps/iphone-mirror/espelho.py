import asyncio
import json
import logging
import os
from pathlib import Path
import queue
import sys
import threading
import time
import tkinter as tk
from tkinter import ttk

from PIL import Image, ImageTk

from capture import CaptureError, list_usb, view
from controls import back_swipe, key_usage, touch_position
from render import LatestFrameRenderer

VERSION = "0.6.0"
TITLE = "Fazenda de Celulares"
BG, SURFACE, CONTROL = "#0c0c0f", "#17171c", "#292930"
TEXT, MUTED, ACCENT, SCREEN = "#fafafa", "#bdbdc8", "#c8233a", "#08080a"
BORDER, HIGHLIGHT, SUCCESS = "#3b3b46", "#ff8792", "#87d8bb"


class Job:
    def __init__(self, action, finish):
        self.loop = self.task = None
        self.stopping = threading.Event()

        async def run():
            self.loop = asyncio.get_running_loop()
            self.task = asyncio.current_task()
            if self.stopping.is_set():
                return
            await action()

        def work():
            try:
                asyncio.run(run(), loop_factory=asyncio.SelectorEventLoop)
            except asyncio.CancelledError:
                pass
            except CaptureError as exc:
                finish(str(exc))
            except Exception as exc:
                logging.warning("Operação USB falhou (%s)", type(exc).__name__)
                finish("O serviço USB da Apple não respondeu. Confira o driver Apple Mobile Device.")

        self.thread = threading.Thread(target=work, daemon=True)
        self.thread.start()

    def cancel(self):
        if self.stopping.is_set():
            return
        self.stopping.set()
        if self.loop and self.task:
            try:
                self.loop.call_soon_threadsafe(self.task.cancel)
            except RuntimeError:
                pass


class Viewer:
    def __init__(self, root):
        self.root = root
        self.events = queue.SimpleQueue()
        self.renderer = LatestFrameRenderer()
        self.photo = None
        self.drawn_rotation = 0
        self.bounds = None
        self.input_channel = None
        self.pointer = None
        self.last_scroll = 0.0
        self.pressed = {}
        self.devices = {}
        self.status = tk.StringVar(value="Conecte um iPhone desbloqueado por USB.")
        self.control_status = tk.StringVar(value="")
        self.selection = tk.StringVar()
        self.job = None
        self.active_capture = False
        self.closing = False
        self.fullscreen = False
        self.focus_status = tk.StringVar(value="")

        root.title(TITLE)
        root.geometry("1150x820")
        root.minsize(740, 600)
        root.configure(bg=BG)
        root.protocol("WM_DELETE_WINDOW", self.close)
        root.after_idle(lambda: root.state("zoomed"))
        root.bind("<F11>", self.toggle_fullscreen)
        root.bind("<Escape>", self.exit_fullscreen)
        root.bind("<Alt-Left>", self.go_back)
        root.grid_rowconfigure(1, weight=1)
        root.grid_columnconfigure(1, weight=1)

        style = ttk.Style(root)
        style.theme_use("clam")
        style.configure("Phone.TButton", background=CONTROL, foreground=TEXT,
                        relief="flat", borderwidth=0, padding=(10, 8), font=("Segoe UI", 10))
        style.map("Phone.TButton", background=[("disabled", SURFACE), ("pressed", "#484850"), ("active", "#36363f")],
                  foreground=[("disabled", "#888894")])
        style.configure("Primary.TButton", background=ACCENT, foreground="white",
                        relief="flat", borderwidth=0, padding=(10, 9), font=("Segoe UI", 10, "bold"))
        style.map("Primary.TButton", background=[("disabled", CONTROL), ("pressed", "#98192b"), ("active", "#de2f49")],
                  foreground=[("disabled", MUTED)])
        style.configure("Phone.TCombobox", background=CONTROL, fieldbackground=CONTROL,
                        foreground=TEXT, selectforeground=TEXT, selectbackground=CONTROL,
                        arrowcolor=TEXT, borderwidth=0, padding=(8, 7))
        style.map("Phone.TCombobox", fieldbackground=[("readonly", CONTROL), ("disabled", SURFACE)],
                  foreground=[("readonly", TEXT), ("disabled", MUTED)])
        root.option_add("*TCombobox*Listbox.background", CONTROL)
        root.option_add("*TCombobox*Listbox.foreground", TEXT)
        root.option_add("*TCombobox*Listbox.selectBackground", ACCENT)

        self.header = tk.Frame(root, bg=SURFACE, padx=20, pady=13, highlightthickness=1,
                               highlightbackground=BORDER)
        self.header.grid(row=0, column=0, columnspan=2, sticky="ew")
        mark = Path(__file__).with_name("mark.png")
        if not mark.exists():
            mark = Path(__file__).resolve().parents[2] / "public" / "brand" / "mark.png"
        if mark.exists():
            with Image.open(mark) as artwork:
                logo = artwork.convert("RGBA")
                logo.thumbnail((44, 44), Image.Resampling.LANCZOS)
                self.logo = ImageTk.PhotoImage(logo, master=root)
            root.iconphoto(True, self.logo)
            tk.Label(self.header, image=self.logo, bg=SURFACE).pack(side="left", padx=(0, 12))
        heading = tk.Frame(self.header, bg=SURFACE)
        heading.pack(side="left")
        tk.Label(heading, text="MAUSEHOT", font=("Segoe UI", 9, "bold"), bg=SURFACE, fg=HIGHLIGHT).pack(anchor="w")
        tk.Label(heading, text=TITLE, font=("Segoe UI", 17, "bold"), bg=SURFACE, fg=TEXT).pack(anchor="w")
        self.connection_badge = tk.Label(self.header, text="Aguardando conexão", bg=CONTROL, fg=MUTED,
                                         font=("Segoe UI", 9, "bold"), padx=12, pady=7)
        self.connection_badge.pack(side="right")

        self.sidebar = tk.Frame(root, bg=SURFACE, padx=20, pady=19, highlightthickness=1,
                                highlightbackground=BORDER)
        self.sidebar.grid(row=1, column=0, sticky="nsw")
        tk.Label(self.sidebar, text="iPhone por USB", font=("Segoe UI", 11, "bold"), bg=SURFACE, fg=TEXT).pack(anchor="w", pady=(0, 10))
        self.picker = ttk.Combobox(self.sidebar, textvariable=self.selection, state="readonly", width=20, style="Phone.TCombobox")
        self.picker.pack(fill="x", pady=(0, 6))
        self.picker.bind("<<ComboboxSelected>>", lambda _: self.refresh_buttons())
        self.view_button = ttk.Button(self.sidebar, text="Conectar e abrir tela", command=self.start, style="Primary.TButton")
        self.view_button.pack(fill="x", pady=(0, 6))
        actions = tk.Frame(self.sidebar, bg=SURFACE)
        actions.pack(fill="x")
        self.search_button = ttk.Button(actions, text="Buscar iPhones", command=self.search, style="Phone.TButton")
        self.search_button.pack(side="left", fill="x", expand=True, padx=(0, 5))
        self.stop_button = ttk.Button(actions, text="Parar", command=self.stop, style="Phone.TButton", width=6)
        self.stop_button.pack(side="right", fill="x")
        tk.Label(self.sidebar, textvariable=self.status, anchor="w", justify="left", wraplength=198,
                 bg=SURFACE, fg=MUTED, font=("Segoe UI", 9)).pack(fill="x", pady=(8, 12))

        tk.Frame(self.sidebar, bg=BORDER, height=1).pack(fill="x", pady=(5, 14))
        tk.Label(self.sidebar, text="Navegação", font=("Segoe UI", 11, "bold"), bg=SURFACE, fg=TEXT).pack(anchor="w", pady=(0, 7))
        controls = tk.Frame(self.sidebar, bg=SURFACE)
        controls.pack(fill="x")
        self.phone_buttons = []
        for column in range(2):
            controls.grid_columnconfigure(column, weight=1, uniform="controls")
        for index, (text, action) in enumerate((
            ("Voltar", self.go_back),
            ("Início", lambda: self.press_phone_button("home")),
            ("Volume −", lambda: self.press_phone_button("volume-down")),
            ("Volume +", lambda: self.press_phone_button("volume-up")),
            ("Bloquear", lambda: self.press_phone_button("lock")),
        )):
            button = ttk.Button(controls, text=text, style="Phone.TButton", command=action)
            button.grid(row=index // 2, column=index % 2, sticky="ew", padx=2, pady=2,
                        columnspan=2 if index == 4 else 1)
            self.phone_buttons.append(button)
        tk.Frame(self.sidebar, bg=BORDER, height=1).pack(fill="x", pady=(14, 12))
        ttk.Button(self.sidebar, text="Tela cheia   F11", style="Phone.TButton",
                   command=self.toggle_fullscreen).pack(fill="x", pady=(0, 10))
        tk.Label(self.sidebar, textvariable=self.control_status, anchor="w", justify="left", wraplength=198,
                 bg=SURFACE, fg=MUTED, font=("Segoe UI", 9)).pack(fill="x")

        self.stage = tk.Frame(root, bg=SCREEN)
        self.stage.grid(row=1, column=1, sticky="nsew")
        self.fullscreen_exit = ttk.Button(self.stage, text="Sair da tela cheia   Esc", style="Phone.TButton", command=self.exit_fullscreen)
        self.focus_label = tk.Label(self.stage, textvariable=self.focus_status, bg=SURFACE, fg=HIGHLIGHT,
                                    font=("Segoe UI", 9), padx=9, pady=5)
        self.canvas = tk.Canvas(self.stage, bg=SCREEN, borderwidth=0, highlightthickness=0, takefocus=True)
        self.canvas.pack(expand=True, fill="both")
        self.canvas.bind("<Configure>", self.resize)
        self.canvas.bind("<ButtonPress-1>", self.pointer_down)
        self.canvas.bind("<B1-Motion>", self.pointer_move)
        self.canvas.bind("<ButtonRelease-1>", self.pointer_up)
        self.canvas.bind("<MouseWheel>", self.scroll)
        self.canvas.bind("<KeyPress>", self.key_down)
        self.canvas.bind("<KeyRelease>", self.key_up)
        self.canvas.bind("<F11>", self.toggle_fullscreen)
        self.canvas.bind("<Escape>", self.canvas_escape)
        self.canvas.bind("<Alt-Left>", self.go_back)
        self.canvas.bind("<FocusIn>", self.update_focus)
        self.canvas.bind("<FocusOut>", self.on_blur)
        self.placeholder = self.canvas.create_text(0, 0, text="Selecione um iPhone para abrir a tela", fill=MUTED,
                                                    font=("Segoe UI", 15, "bold"))
        self.image = self.canvas.create_image(0, 0)
        self.touch_marker = self.canvas.create_oval(0, 0, 0, 0, outline=HIGHLIGHT, width=2, state="hidden")
        self.marker_timer = None
        self.refresh_buttons()
        root.after(30, self.tick)
        root.after(150, self.search)

    def refresh_buttons(self):
        busy = self.job is not None
        self.search_button.configure(state="disabled" if busy else "normal")
        self.view_button.configure(state="normal" if not busy and self.selection.get() in self.devices else "disabled")
        self.stop_button.configure(state="normal" if busy and self.active_capture else "disabled")
        self.picker.configure(state="disabled" if busy else "readonly")
        for button in self.phone_buttons:
            button.configure(state="normal" if self.input_channel else "disabled")

    def search(self):
        if self.job is not None:
            return
        self.status.set("Consultando os dispositivos Apple no Windows…")

        async def action():
            self.events.put(("devices", await list_usb()))

        self.job = Job(action, lambda error: self.events.put(("scan_error", error)))
        self.refresh_buttons()

    def start(self):
        serial = self.devices.get(self.selection.get())
        if not serial or self.job:
            return
        self.active_capture = True
        self.status.set("Preparando a tela do iPhone…")
        self.connection_badge.configure(text="Conectando", fg=HIGHLIGHT)

        def status(message):
            self.events.put(("status", message))

        def show(frame, label, rotation):
            self.renderer.publish(frame, rotation)
            if label != show.label:
                show.label = label
                self.events.put(("frame_mode", label))

        show.label = None
        self.job = Job(
            lambda: view(
                serial, status, show, lambda channel: self.events.put(("input", channel)),
                lambda error: self.events.put(("input_error", error)),
            ),
            lambda error: self.events.put(("error", error)),
        )
        self.refresh_buttons()

    def stop(self):
        if self.job:
            self.release_input()
            self.status.set("Encerrando a visualização…")
            self.job.cancel()
            self.stop_button.configure(state="disabled")

    def close(self):
        self.closing = True
        if self.job:
            self.stop()
        else:
            self.renderer.close()
            self.root.destroy()

    def resize(self, event):
        if self.pointer is not None:
            self.release_input()
        self.bounds = None
        self.canvas.coords(self.placeholder, event.width // 2, event.height // 2)
        self.canvas.coords(self.image, event.width // 2, event.height // 2)
        self.update_viewport(event.width, event.height)

    def update_viewport(self, width, height):
        inset = 0 if self.fullscreen else 18
        self.renderer.resize(width - inset, height - inset)

    def toggle_fullscreen(self, _event=None):
        self.release_input()
        self.fullscreen = not self.fullscreen
        self.root.attributes("-fullscreen", self.fullscreen)
        if self.fullscreen:
            self.header.grid_remove()
            self.sidebar.grid_remove()
            self.fullscreen_exit.place(relx=1, x=-12, y=12, anchor="ne")
        else:
            self.header.grid()
            self.sidebar.grid()
            self.fullscreen_exit.place_forget()
        self.update_viewport(self.canvas.winfo_width(), self.canvas.winfo_height())
        self.canvas.focus_set()
        return "break"

    def exit_fullscreen(self, _event=None):
        if self.fullscreen:
            return self.toggle_fullscreen()

    def canvas_escape(self, event):
        if self.fullscreen:
            return self.exit_fullscreen()
        return self.key_down(event)

    def update_focus(self, _event=None):
        if self.input_channel and self.root.focus_get() == self.canvas:
            self.focus_status.set("Teclado no iPhone")
            self.focus_label.place(relx=1, rely=1, x=-12, y=-12, anchor="se")
        else:
            self.focus_label.place_forget()

    def on_blur(self, _event=None):
        self.release_input()
        self.focus_label.place_forget()

    def show_touch_marker(self, x, y):
        self.canvas.coords(self.touch_marker, x - 8, y - 8, x + 8, y + 8)
        self.canvas.itemconfigure(self.touch_marker, state="normal")
        if self.marker_timer is not None:
            self.root.after_cancel(self.marker_timer)
        self.marker_timer = self.root.after(220, self.hide_touch_marker)

    def hide_touch_marker(self):
        self.marker_timer = None
        self.canvas.itemconfigure(self.touch_marker, state="hidden")

    def press_phone_button(self, name):
        if self.input_channel:
            self.input_channel.post("button", name)

    def go_back(self, _event=None):
        if self.input_channel and self.bounds:
            self.release_input()
            self.input_channel.post("back", *back_swipe(self.drawn_rotation))
        return "break"

    def pointer_down(self, event):
        if not self.input_channel or not self.bounds:
            return
        self.pointer = touch_position(event.x, event.y, self.bounds, self.drawn_rotation)
        if self.pointer is not None:
            self.canvas.focus_set()
            self.show_touch_marker(event.x, event.y)
            self.input_channel.post("touch", "contact", *self.pointer)
        return "break"

    def pointer_move(self, event):
        if self.pointer is None or not self.input_channel or not self.bounds:
            return
        position = touch_position(event.x, event.y, self.bounds, self.drawn_rotation, clamp=True)
        if position is not None and position != self.pointer:
            self.pointer = position
            self.input_channel.post("move", *position)
        return "break"

    def pointer_up(self, event):
        if self.pointer is None or not self.input_channel or not self.bounds:
            return
        position = touch_position(event.x, event.y, self.bounds, self.drawn_rotation, clamp=True)
        self.input_channel.post("finish-touch", *(position or self.pointer))
        self.pointer = None
        return "break"

    def scroll(self, event):
        if not self.input_channel or not self.bounds or self.pointer is not None or not event.delta:
            return
        now = time.monotonic()
        if now - self.last_scroll < 0.11:
            return "break"
        left, top, right, bottom = self.bounds
        if not (left <= event.x <= right and top <= event.y <= bottom):
            return
        height = bottom - top
        y = max(top + 0.3 * height, min(bottom - 0.3 * height, event.y))
        distance = height * 0.22 * (1 if event.delta > 0 else -1)
        start = touch_position(event.x, y, self.bounds, self.drawn_rotation)
        end = touch_position(event.x, y + distance, self.bounds, self.drawn_rotation)
        if start and end:
            self.last_scroll = now
            self.input_channel.post("scroll", *start, *end)
        return "break"

    def key_down(self, event):
        if not self.input_channel:
            return
        if event.state & 0x4 and event.keysym.lower() == "v":
            try:
                text = self.root.clipboard_get()
            except tk.TclError:
                return "break"
            if text:
                self.pressed.clear()
                self.input_channel.post("keys", ())
                self.input_channel.post("paste", text[:16000])
            return "break"
        usage = key_usage(event.keysym, event.keycode, event.char)
        if usage is not None and event.keycode not in self.pressed:
            self.pressed[event.keycode] = usage
            self.input_channel.post("keys", tuple(self.pressed.values()))
        return "break"

    def key_up(self, event):
        if self.input_channel and self.pressed.pop(event.keycode, None) is not None:
            self.input_channel.post("keys", tuple(self.pressed.values()))
        if self.input_channel:
            return "break"

    def release_input(self, _event=None):
        if self.input_channel and (self.pointer is not None or self.pressed):
            self.input_channel.post("release")
        self.pointer = None
        self.pressed.clear()

    def tick(self):
        while True:
            try:
                event, value = self.events.get_nowait()
            except queue.Empty:
                break
            if event in ("devices", "scan_error"):
                previous = self.devices.get(self.selection.get())
                serials = value if event == "devices" else []
                self.devices = {f"iPhone {index} · {serial[-4:]}": serial for index, serial in enumerate(serials, 1)}
                self.picker["values"] = tuple(self.devices)
                self.selection.set(next((label for label, serial in self.devices.items() if serial == previous),
                                        next(iter(self.devices), "")))
                if event == "scan_error":
                    self.status.set(value)
                elif self.devices:
                    self.status.set("iPhone detectado. Escolha o aparelho e clique em Conectar e abrir tela.")
                else:
                    self.status.set("O Windows não detectou nenhum iPhone por USB. Use um cabo de dados, desbloqueie o aparelho e clique em Buscar iPhones.")
            elif event == "input":
                self.input_channel = value
                self.release_input()
                self.refresh_buttons()
                self.canvas.configure(cursor="crosshair" if value else "")
                self.update_focus()
                if value:
                    self.connection_badge.configure(text="Controle ativo", fg=SUCCESS)
                self.control_status.set("Clique para digitar. Arraste ou role com a roda. Alt + ← volta em telas compatíveis." if value else "")
            elif event == "input_error":
                self.control_status.set(value)
                if self.fullscreen:
                    self.exit_fullscreen()
            elif event == "error":
                self.exit_fullscreen()
                self.status.set(value)
            elif event == "frame_mode":
                self.status.set(value)
                if not self.input_channel:
                    self.connection_badge.configure(text="Somente visualização", fg=MUTED)
                    self.control_status.set("Modo visual. Este iOS não oferece controle direto por mouse e teclado.")
            else:
                self.status.set(value)

        if self.job and not self.job.thread.is_alive():
            if self.closing:
                self.renderer.close()
                self.root.destroy()
                return
            if self.job.stopping.is_set():
                self.status.set("Visualização encerrada.")
            if self.active_capture:
                self.renderer.clear()
                self.canvas.itemconfigure(self.image, image="")
                self.canvas.itemconfigure(self.placeholder, state="normal")
                self.photo = self.bounds = None
                self.connection_badge.configure(text="Sessão encerrada", fg=MUTED)
                self.control_status.set("")
            self.job = None
            self.active_capture = False
            self.refresh_buttons()

        rendered = self.renderer.take()
        if rendered is not None:
            frame, rotation = rendered
            # Reuse the Tk image while its dimensions are unchanged.
            if self.photo and (self.photo.width(), self.photo.height()) == frame.size:
                self.photo.paste(frame)
            else:
                self.photo = ImageTk.PhotoImage(frame)
                self.canvas.itemconfigure(self.image, image=self.photo)
                self.canvas.itemconfigure(self.placeholder, state="hidden")
            if rotation != self.drawn_rotation:
                self.release_input()
            self.drawn_rotation = rotation
            self.bounds = self.canvas.bbox(self.image)
        self.root.after(17 if self.active_capture else 65, self.tick)


def main():
    if sys.argv[1:2] == ["--diagnostico"] and len(sys.argv) == 3:
        import av
        from live_video import ViewOnlyStream

        result = {"version": VERSION, "hevc": bool(av.CodecContext.create("hevc", "r")),
                  "live_service": ViewOnlyStream.__name__}
        try:
            result["usb_count"] = len(asyncio.run(list_usb(), loop_factory=asyncio.SelectorEventLoop))
        except Exception as exc:
            result["usb_error"] = type(exc).__name__
        Path(sys.argv[2]).write_text(json.dumps(result), encoding="utf-8")
        return

    logs = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "iPhoneEspelho"
    logs.mkdir(exist_ok=True, parents=True)
    logging.basicConfig(filename=logs / "espelho.log", level=logging.WARNING, encoding="utf-8")
    root = tk.Tk()
    Viewer(root)
    root.mainloop()


if __name__ == "__main__":
    main()
