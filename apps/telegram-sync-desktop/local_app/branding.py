import sys
from pathlib import Path
import tkinter as tk


def brand_image(size=44):
    location=Path(getattr(sys,'_MEIPASS',Path(__file__).resolve().parents[1]))/'assets'/'mark.png'
    if not location.exists():
        location=Path(__file__).resolve().parents[3]/'public'/'brand'/'mark.png'
    image=tk.PhotoImage(file=str(location))
    return image.subsample(max(1,(image.width()+size-1)//size))
