import json
import tkinter as tk
from tkinter import ttk, messagebox
from .editor import DEFAULT_URL, decode_entities
from .domain import UserError

STATES = {'pending':'Pendente','applied':'Editado','restored':'Restaurado','conflict':'Conflito: ignorado'}


class EditorTab:
    def __init__(self, window, notebook):
        self.window = window
        self.editor = window.runtime.engine.editor
        self.batch_id = None
        frame = self.frame = ttk.Frame(notebook,padding=16)
        self.channel_refs = {}
        notebook.add(frame,text='  Editar links no canal  ')
        ttk.Label(frame,text='Altera publicações existentes no seu canal, sem copiar ou baixar as mídias.',wraplength=950).pack(anchor='w')
        form = ttk.Frame(frame);form.pack(fill='x',pady=6);form.columnconfigure(1,weight=1)
        self.channel = tk.StringVar()
        self.target = tk.StringVar(value=DEFAULT_URL)
        for row,(label,var) in enumerate((('Canal que você administra',self.channel),('Novo destino dos links',self.target))):
            ttk.Label(form,text=label).grid(row=row,column=0,sticky='w',padx=(0,12),pady=4)
            entry=ttk.Combobox(form,textvariable=var) if row==0 else ttk.Entry(form,textvariable=var)
            entry.grid(row=row,column=1,sticky='ew',pady=4)
            if row==0:self.channel_choice=entry
        ttk.Button(form,text='Meus canais',command=self.channels).grid(row=0,column=2,padx=(8,0))
        ttk.Label(frame,text='Use @username, link público t.me ou ID -100… do canal. O título será confirmado na prévia.',wraplength=950).pack(anchor='w')
        self.ads=tk.BooleanVar(value=False);self.plain=tk.BooleanVar(value=False)
        ttk.Checkbutton(frame,text='Remover linhas “outros grupos” e “Hentai” (preserva a publicação)',variable=self.ads).pack(anchor='w',pady=(6,0))
        ttk.Checkbutton(frame,text='Incluir URLs escritas por extenso: manter o texto visível e trocar o destino clicável',variable=self.plain).pack(anchor='w')
        ttk.Label(frame,text='Por padrão, altera todos os links embutidos no texto (Ctrl+K). Menções e botões não são alterados.',wraplength=950).pack(anchor='w')
        controls=ttk.Frame(frame);controls.pack(fill='x',pady=8)
        ttk.Button(controls,text='1. Analisar todo o histórico',command=self.scan).pack(side='left')
        ttk.Button(controls,text='2. Aplicar prévia / retomar',command=self.apply).pack(side='left',padx=8)
        ttk.Button(controls,text='Pausar operação',command=self.stop).pack(side='left')
        ttk.Button(controls,text='Restaurar textos originais',command=lambda:self.apply(True)).pack(side='right')
        history=ttk.Frame(frame);history.pack(fill='x')
        ttk.Label(history,text='Análises salvas:').pack(side='left',padx=(0,8))
        self.history=ttk.Combobox(history,state='readonly');self.history.pack(side='left',fill='x',expand=True)
        self.history.bind('<<ComboboxSelected>>',self.choose)
        ttk.Button(history,text='Atualizar prévia',command=self.refresh).pack(side='right',padx=(8,0))
        self.summary=tk.StringVar(value='Primeiro pause as sincronizações e analise o canal. Nenhum post é editado durante a análise.')
        ttk.Label(frame,textvariable=self.summary,wraplength=950).pack(anchor='w',pady=6)
        self.tree=ttk.Treeview(frame,columns=('id','state','links','text'),show='headings',height=3,selectmode='browse')
        for name,label,width in [('id','Post',70),('state','Estado',150),('links','Links',55),('text','Texto / legenda',550)]:
            self.tree.heading(name,text=label);self.tree.column(name,width=width,minwidth=50)
        scroll=ttk.Scrollbar(frame,orient='vertical',command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        table=ttk.Frame(frame);table.pack(fill='both',expand=True)
        self.tree.pack(in_=table,side='left',fill='both',expand=True)
        scroll.pack(in_=table,side='right',fill='y')
        self.tree.bind('<<TreeviewSelect>>',self.details)
        self.detail=tk.Text(frame,height=4,bg='#171e2d',fg='#c9d9ee',wrap='word',state='disabled')
        self.detail.pack(fill='both',expand=True,pady=(8,0))
        self.refresh()

    def stop(self):
        self.editor.cancel.set()
        self.window.notify('Pausa solicitada. A operação atual será concluída antes de parar.')

    def channels(self):
        def loaded(channels):
            self.channel_refs={f'{title} | {reference}':reference for reference,title in channels}
            self.channel_choice.configure(values=list(self.channel_refs))
            self.window.notify('Escolha seu canal na lista.' if channels else 'Nenhum canal com permissão de edição foi encontrado nesta conta.')
            if channels:self.channel_choice.focus_set()
        self.window.dispatch(self.editor.channels(),loaded)

    def scan(self):
        if self.window.busy:
            self.window.notify('Aguarde a operação atual.');return
        self.window.dispatch(self.editor.scan(self.channel_refs.get(self.channel.get(),self.channel.get()),self.target.get(),self.ads.get(),self.plain.get()),self.complete)

    def complete(self, batch_id):
        self.batch_id=batch_id
        self.refresh()
        self.window.notify(self.editor.db.batch(batch_id)['note'])

    def choose(self, _event=None):
        self.batch_id=self.ids[self.history.current()]
        self.refresh()

    def refresh(self):
        batches=self.editor.db.batches()
        self.ids=[b['id'] for b in batches]
        self.history.configure(values=[f"#{b['id']} | {b['title']} | {b['created_at'][:19]} UTC" for b in batches])
        if self.batch_id is None and batches:self.batch_id=batches[0]['id']
        if self.batch_id not in self.ids:return
        self.history.current(self.ids.index(self.batch_id))
        batch=self.editor.db.batch(self.batch_id)
        items=self.editor.db.items(self.batch_id)
        counts={s:sum(i['status']==s for i in items) for s in STATES}
        self.summary.set(f"{batch['title']} ({batch['channel']}) → {batch['target']}\n{batch['note']} | Pendentes: {counts['pending']} | Editados: {counts['applied']} | Restaurados: {counts['restored']} | Conflitos: {counts['conflict']}")
        selected=self.tree.selection()
        self.tree.delete(*self.tree.get_children())
        self.items={str(i['message_id']):i for i in items}
        for item in items:
            original=json.loads(item['original'])
            self.tree.insert('','end',iid=str(item['message_id']),values=(item['message_id'],STATES[item['status']],len(json.loads(item['links'])),original['text'].replace('\n',' ')[:180]))
        if selected and selected[0] in self.items:self.tree.selection_set(selected)
        self.details()

    def details(self, _event=None):
        selected=self.tree.selection()
        text='Selecione um post para conferir o texto original, a proposta e os destinos dos links.'
        if selected and selected[0] in self.items:
            item=self.items[selected[0]];original=json.loads(item['original']);desired=json.loads(item['desired'])
            urls=[e.url for e in decode_entities(desired['entities']) if hasattr(e,'url')]
            text=f"POST {item['message_id']} | {STATES[item['status']]}\n{item['note']}\n\nORIGINAL\n{original['text']}\n\nPROPOSTA\n{desired['text']}\n\nDESTINOS ANTERIORES ALTERADOS\n"+'\n'.join(json.loads(item['links']))+'\n\nDESTINOS NA PROPOSTA\n'+'\n'.join(urls)
        self.detail.configure(state='normal');self.detail.delete('1.0','end');self.detail.insert('1.0',text);self.detail.configure(state='disabled')

    def apply(self, restore=False):
        if self.window.busy:
            self.window.notify('Aguarde a operação atual.');return
        try:
            if self.batch_id is None:raise UserError('Analise o canal primeiro.')
            batch=self.editor.db.batch(self.batch_id)
            if batch['status'] in ('scanning','incomplete'):raise UserError('Faça uma nova análise: esta foi interrompida.')
            items=[i for i in self.editor.db.items(self.batch_id) if i['status']==('applied' if restore else 'pending')]
            if not items:raise UserError('Não há publicações elegíveis para esta operação nesta análise.')
            action='Restaurar os textos originais de' if restore else 'Editar os links e textos de'
            prompt=f"{action} {len(items)} publicações?\n\nCanal: {batch['title']}\nID: {batch['channel']}\nNovo destino: {batch['target']}\n\nA operação usará a prévia salva desta análise. Posts modificados desde a prévia serão ignorados. Nenhuma publicação será apagada."
            if messagebox.askyesno('Confirmar restauração' if restore else 'Confirmar edição no Telegram',prompt,parent=self.window.root):
                self.window.dispatch(self.editor.apply(self.batch_id,restore),self.complete)
        except UserError as reason:self.window.notify(str(reason),True)
