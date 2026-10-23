"""Shared, dependency-free desktop visual system matching the 00duHot site."""
import tkinter as tk
from tkinter import ttk, font as tkfont

BG='#101010'
SIDEBAR='#0c0c0c'
CARD='#171717'
INPUT='#222222'
BORDER='#30302e'
TEXT='#efede8'
MUTED='#a8a59f'
BLUE='#c9a66b'
GREEN='#a2b4a8'
AMBER='#c9ad80'
RED='#d88983'


def theme(root):
    root.configure(bg=BG)
    root.option_add('*TCombobox*Listbox.background',INPUT)
    root.option_add('*TCombobox*Listbox.foreground',TEXT)
    root.option_add('*TCombobox*Listbox.selectBackground','#463c2d')
    style=ttk.Style(root);style.theme_use('clam')
    style.configure('.',font=('Segoe UI',10),background=BG,foreground=TEXT,bordercolor=BORDER,lightcolor=BORDER,darkcolor=BORDER)
    style.configure('TFrame',background=BG)
    style.configure('Card.TFrame',background=CARD)
    style.configure('TLabel',background=BG,foreground=TEXT)
    style.configure('Muted.TLabel',foreground=MUTED)
    style.configure('Card.TLabel',background=CARD)
    style.configure('CardMuted.TLabel',background=CARD,foreground=MUTED)
    style.configure('Hero.TLabel',font=('Segoe UI',25,'bold'))
    style.configure('Heading.TLabel',font=('Segoe UI',15,'bold'))
    style.configure('CardHeading.TLabel',background=CARD,font=('Segoe UI',12,'bold'))
    style.configure('Eyebrow.TLabel',foreground=BLUE,font=('Segoe UI',9,'bold'))
    style.configure('TButton',padding=(14,9),background='#282724',borderwidth=1,foreground=TEXT)
    style.map('TButton',background=[('active','#35332e'),('disabled','#222222')],foreground=[('disabled','#85817a')])
    style.configure('Primary.TButton',background='#c9a66b',foreground='#15120d',font=('Segoe UI',10,'bold'))
    style.map('Primary.TButton',background=[('active','#d8b983'),('disabled','#3c352a')],foreground=[('disabled','#9a907f')])
    style.configure('Danger.TButton',background='#2d2322',foreground=RED)
    style.map('Danger.TButton',background=[('active','#42302d'),('disabled','#252222')])
    style.configure('Quiet.TButton',background=CARD,padding=(10,6))
    style.configure('TEntry',fieldbackground=INPUT,insertcolor=TEXT,padding=9,borderwidth=1)
    style.map('TEntry',bordercolor=[('focus',BLUE)])
    style.configure('TCombobox',fieldbackground=INPUT,background=INPUT,arrowcolor=MUTED,padding=8)
    style.map('TCombobox',fieldbackground=[('readonly',INPUT)],foreground=[('readonly',TEXT)],selectbackground=[('readonly',INPUT)],selectforeground=[('readonly',TEXT)])
    for name in ('TCheckbutton','TRadiobutton'):
        style.configure(name,background=CARD,padding=5)
        style.map(name,background=[('active',CARD)],indicatorcolor=[('selected','#c9a66b'),('!selected',INPUT)])
    style.configure('Treeview',background=CARD,fieldbackground=CARD,foreground=TEXT,rowheight=38,borderwidth=0)
    style.map('Treeview',background=[('selected','#40382b')],foreground=[('selected','white')])
    style.configure('Treeview.Heading',background=INPUT,foreground=MUTED,font=('Segoe UI',9,'bold'),padding=(10,10),relief='flat')
    style.map('Treeview.Heading',background=[('active','#33312d')])
    style.configure('TScrollbar',background='#3c3932',troughcolor=BG,borderwidth=0,arrowsize=12)
    style.configure('Horizontal.TProgressbar',background=BLUE,troughcolor=INPUT,borderwidth=0)
    style.configure('Page.TNotebook',background=BG,borderwidth=0,tabmargins=0)
    style.layout('Page.TNotebook.Tab',[])


class ScrollPage(ttk.Frame):
    def __init__(self,parent,padding=26):
        super().__init__(parent)
        self.canvas=tk.Canvas(self,bg=BG,highlightthickness=0)
        scrollbar=ttk.Scrollbar(self,orient='vertical',command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side='right',fill='y');self.canvas.pack(side='left',fill='both',expand=True)
        self.inner=ttk.Frame(self.canvas,padding=padding)
        self.content=self.canvas.create_window((0,0),window=self.inner,anchor='nw')
        self.inner.bind('<Configure>',lambda _e:self.canvas.configure(scrollregion=self.canvas.bbox('all')))
        self.canvas.bind('<Configure>',lambda e:self.canvas.itemconfigure(self.content,width=e.width))
        self.winfo_toplevel().bind('<MouseWheel>',self._wheel,add='+')

    def _wheel(self,event):
        current=event.widget
        if current.winfo_class() in ('Text','Treeview','Listbox','TCombobox'):
            return
        while current is not None:
            if current is self:
                if self.canvas.bbox('all') and self.canvas.bbox('all')[3]>self.canvas.winfo_height():
                    self.canvas.yview_scroll(-int(event.delta/120) if abs(event.delta)>=120 else (-1 if event.delta>0 else 1),'units')
                return
            current=getattr(current,'master',None)


def heading(parent,kicker,title,description):
    ttk.Label(parent,text=kicker.upper(),style='Eyebrow.TLabel').pack(anchor='w')
    ttk.Label(parent,text=title,style='Hero.TLabel').pack(anchor='w',pady=(5,5))
    label=ttk.Label(parent,text=description,style='Muted.TLabel',wraplength=740)
    label.pack(anchor='w',pady=(0,22))
    parent.bind('<Configure>',lambda e:label.configure(wraplength=max(300,e.width-12)),add='+')


def card(parent,title=None,subtitle=None):
    border=tk.Frame(parent,bg=BORDER,padx=1,pady=1)
    border.pack(fill='x',pady=(0,16))
    inside=ttk.Frame(border,style='Card.TFrame',padding=18);inside.pack(fill='both',expand=True)
    if title:ttk.Label(inside,text=title,style='CardHeading.TLabel').pack(anchor='w',pady=(0,6))
    if subtitle:
        label=ttk.Label(inside,text=subtitle,style='CardMuted.TLabel',wraplength=700)
        label.pack(anchor='w',pady=(0,12))
        inside.bind('<Configure>',lambda e:label.configure(wraplength=max(250,e.width-40)),add='+')
    return inside


class Metric:
    def __init__(self,parent,title,description,color=BLUE,compact=False):
        self.frame=tk.Frame(parent,bg=BORDER,padx=1,pady=1)
        inner=tk.Frame(self.frame,bg=CARD,padx=14,pady=7 if compact else 13);inner.pack(fill='both',expand=True)
        tk.Label(inner,text=title,bg=CARD,fg=MUTED,font=('Segoe UI',9 if compact else 10)).pack(anchor='w')
        self.value=tk.StringVar(value='0')
        tk.Label(inner,textvariable=self.value,bg=CARD,fg=TEXT,font=('Segoe UI',20 if compact else 27,'bold')).pack(anchor='w',pady=(4,2))
        self.description=tk.StringVar(value=description)
        self.caption=tk.Label(inner,textvariable=self.description,bg=CARD,fg=MUTED,font=('Segoe UI',8 if compact else 9),wraplength=160,justify='left')
        self.caption.pack(anchor='w')
        inner.bind('<Configure>',lambda e:self.caption.configure(wraplength=max(90,e.width-32)))


def metrics(parent,definitions,compact=False):
    row=ttk.Frame(parent);row.pack(fill='x',pady=(0,8 if compact else 20))
    result={}
    for index,(key,title,description,color) in enumerate(definitions):
        row.columnconfigure(index,weight=1,uniform='metric')
        metric=Metric(row,title,description,color,compact);metric.frame.grid(row=0,column=index,sticky='nsew',padx=(0,10 if index<len(definitions)-1 else 0))
        result[key]=metric
    return result


def text_box(parent,height=5,color=TEXT):
    holder=ttk.Frame(parent,style='Card.TFrame');holder.pack(fill='both',expand=True)
    widget=tk.Text(holder,height=height,bg='#121212',fg=color,insertbackground=TEXT,selectbackground='#463c2d',wrap='word',relief='flat',padx=12,pady=12,font=('Segoe UI',10),undo=False)
    bar=ttk.Scrollbar(holder,orient='vertical',command=widget.yview);widget.configure(yscrollcommand=bar.set)
    bar.pack(side='right',fill='y');widget.pack(side='left',fill='both',expand=True)
    return widget


def table(parent,columns,height=6):
    holder=ttk.Frame(parent,style='Card.TFrame');holder.pack(fill='both',expand=True,pady=(6,8))
    tree=ttk.Treeview(holder,columns=[c[0] for c in columns],show='headings',height=height,selectmode='browse')
    for name,label,width in columns:
        tree.heading(name,text=label);tree.column(name,width=width,minwidth=60,stretch=True)
    header_font=tkfont.Font(parent,font=('Segoe UI',9,'bold'))
    minimums=[max(65,header_font.measure(label)+24) for _,label,_ in columns]
    weights=[width for _,_,width in columns]
    def fit(event):
        available=max(0,event.width-4-sum(minimums))
        for index,(name,_,_) in enumerate(columns):
            tree.column(name,minwidth=minimums[index],width=minimums[index]+int(available*weights[index]/sum(weights)))
    tree.bind('<Configure>',fit,add='+')
    vertical=ttk.Scrollbar(holder,orient='vertical',command=tree.yview)
    horizontal=ttk.Scrollbar(holder,orient='horizontal',command=tree.xview)
    tree.configure(yscrollcommand=vertical.set,xscrollcommand=horizontal.set)
    holder.rowconfigure(0,weight=1);holder.columnconfigure(0,weight=1)
    tree.grid(row=0,column=0,sticky='nsew');vertical.grid(row=0,column=1,sticky='ns');horizontal.grid(row=1,column=0,sticky='ew')
    for tag,color in [('running',BLUE),('completed',GREEN),('applied',GREEN),('paused',AMBER),('attention',RED),('conflict',AMBER),('restored',BLUE),('cancelled',MUTED)]:
        tree.tag_configure(tag,foreground=color)
    return tree


def readable_count(value):
    return f'{value:,}'.replace(',','.')


class Fold(ttk.Frame):
    """Optional controls stay inline and out of the main task's way."""
    def __init__(self, parent, title):
        super().__init__(parent, style='Card.TFrame')
        self.pack(fill='x', pady=(4, 8))
        self.title=title;self.opened=False
        self.toggle=ttk.Button(self, text='+ '+title, style='Quiet.TButton', command=self.flip)
        self.toggle.pack(anchor='w')
        self.body=ttk.Frame(self, style='Card.TFrame', padding=(8, 10, 8, 4))
    def set_open(self, opened):
        self.opened=bool(opened)
        self.toggle.configure(text=('− ' if self.opened else '+ ')+self.title)
        if self.opened:self.body.pack(fill='x')
        else:self.body.pack_forget()
    def flip(self):self.set_open(not self.opened)


class CompactMetric:
    def __init__(self, parent, title):
        self.value=tk.StringVar(value='0')
        ttk.Label(parent,text=title,style='CardMuted.TLabel').pack(side='left',padx=(0,5))
        ttk.Label(parent,textvariable=self.value,style='CardHeading.TLabel').pack(side='left',padx=(0,20))
