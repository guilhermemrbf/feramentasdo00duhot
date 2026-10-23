import json
import time
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from .editor import DEFAULT_URL, decode_entities
from .domain import UserError
from .reports import export_edit_report
from .design import BLUE, GREEN, AMBER, MUTED, RED, ScrollPage, heading, card, metrics, text_box, table, readable_count, Fold, CompactMetric

STATES={'pending':'Pendente','applied':'Editado','restored':'Restaurado','conflict':'Ignorado: mudou após a prévia'}
FILTERS={'Todas':None,'Pendentes':'pending','Editadas':'applied','Restauradas':'restored','Ignoradas':'conflict'}
BATCH_STATES={'scanning':'Analisando o histórico','ready':'Prévia pronta para conferir','incomplete':'Análise incompleta · faça uma nova análise','applying':'Operação em andamento','paused':'Operação pausada','done':'Operação finalizada'}


class EditorTab:
    def __init__(self,window,parent):
        self.window=window;self.editor=window.runtime.engine.editor
        self.batch_id=None;self.channel_refs={};self.items={};self.operation=None;self.run_total=0;self.run_ids=set();self.ready_inputs=None;self.scanning_inputs=None
        self.frame=ttk.Frame(parent);frame=self.frame
        config=card(frame,'Trocar links do meu canal','1. Escolha seu canal e o novo link. 2. Confira a prévia. 3. Aplique quando estiver pronto.')
        self.channel=tk.StringVar();self.target=tk.StringVar(value=DEFAULT_URL)
        ttk.Label(config,text='Qual canal você administra?',style='Card.TLabel').pack(anchor='w')
        row=ttk.Frame(config,style='Card.TFrame');row.pack(fill='x',pady=(5,8))
        self.channel_choice=ttk.Combobox(row,textvariable=self.channel);self.channel_choice.pack(side='left',fill='x',expand=True)
        self.channels_button=ttk.Button(row,text='Escolher na minha lista',command=self.channels);self.channels_button.pack(side='right',padx=(10,0))
        ttk.Label(config,text='Qual será o novo link?',style='Card.TLabel').pack(anchor='w')
        self.target_entry=ttk.Entry(config,textvariable=self.target);self.target_entry.pack(fill='x',pady=(5,8))
        self.ads=tk.BooleanVar(value=False);self.plain=tk.BooleanVar(value=False)
        self.options=Fold(config,'Opções da próxima análise (opcional)')
        self.option_controls=[]
        for text,var in [('Remover as linhas “outros grupos” e “Hentai”, mantendo o post',self.ads),('Trocar também URLs escritas por extenso',self.plain)]:
            control=ttk.Checkbutton(self.options.body,text=text,variable=var);control.pack(anchor='w');self.option_controls.append(control)
        ttk.Label(self.options.body,text='Sem marcar nada, troca apenas o destino dos links clicáveis (Ctrl+K). O texto e a mídia são mantidos.',style='CardMuted.TLabel',wraplength=900).pack(anchor='w')
        actions=ttk.Frame(config,style='Card.TFrame');actions.pack(fill='x',pady=(8,0))
        self.scan_button=ttk.Button(actions,text='1. Ver prévia',style='Primary.TButton',command=self.scan);self.scan_button.pack(side='left')
        self.apply_button=ttk.Button(actions,text='2. Aplicar alterações',style='Primary.TButton',command=self.apply)
        self.stop_button=ttk.Button(actions,text='Pausar',command=self.stop)
        self.apply_caption=tk.StringVar(value='Ver prévia não altera nenhum post.')
        ttk.Label(config,textvariable=self.apply_caption,style='CardMuted.TLabel',wraplength=900).pack(anchor='w',pady=(8,0))
        self.empty_preview=ttk.Label(frame,text='A prévia aparecerá aqui. Nenhum post muda até você conferir e confirmar.',style='Muted.TLabel');self.empty_preview.pack(anchor='w',pady=(0,12))
        saved=card(frame,'Prévia das alterações');self.preview_card=saved
        counters=ttk.Frame(saved,style='Card.TFrame');counters.pack(fill='x',pady=(0,8))
        self.stats={key:CompactMetric(counters,title) for key,title in [('pending','Pendentes'),('applied','Editadas'),('restored','Restauradas'),('conflict','Ignoradas')]}
        self.summary=tk.StringVar(value='Preencha os dois campos acima e clique em Ver prévia.')
        ttk.Label(saved,textvariable=self.summary,style='CardMuted.TLabel',wraplength=900,justify='left').pack(anchor='w',pady=(0,6))
        self.progress=ttk.Progressbar(saved,mode='determinate');self.progress.pack(fill='x',pady=(0,4))
        self.progress_text=tk.StringVar(value='Nenhuma análise iniciada.')
        ttk.Label(saved,textvariable=self.progress_text,style='CardMuted.TLabel',wraplength=900).pack(anchor='w')
        self.tree=table(saved,[('id','Post',65),('state','Situação',170),('links','Links',70),('text','Texto / legenda',500)],height=3)
        self.tree.configure(selectmode='extended');self.tree.bind('<<TreeviewSelect>>',self.selection_changed)
        self.list_caption=tk.StringVar(value='Clique em um post para conferir o antes e depois.')
        ttk.Label(saved,textvariable=self.list_caption,style='CardMuted.TLabel',wraplength=900).pack(anchor='w')
        columns=ttk.Frame(saved,style='Card.TFrame');columns.pack(fill='both',expand=True,pady=(8,0))
        for index,label in enumerate(('ANTES','DEPOIS')):
            columns.columnconfigure(index,weight=1,uniform='preview')
            side=ttk.Frame(columns,style='Card.TFrame',padding=(0 if index==0 else 8,0,8 if index==0 else 0,0));side.grid(row=0,column=index,sticky='nsew')
            ttk.Label(side,text=label,style='CardMuted.TLabel').pack(anchor='w')
            widget=text_box(side,height=4,color=GREEN if index else MUTED);widget.configure(state='disabled')
            if index:self.detail=widget
            else:self.original_text=widget
        self.selected_note=tk.StringVar(value='Confira os textos e os links antes de aplicar.')
        ttk.Label(saved,textvariable=self.selected_note,style='CardMuted.TLabel',wraplength=900).pack(anchor='w',pady=(6,0))
        scope_row=ttk.Frame(saved,style='Card.TFrame');scope_row.pack(fill='x',pady=(8,0))
        ttk.Label(scope_row,text='Quais posts alterar?',style='Card.TLabel').pack(side='left',padx=(0,10))
        self.scope=tk.StringVar(value='Toda a análise')
        self.scope_choice=ttk.Combobox(scope_row,textvariable=self.scope,values=['Toda a análise','Somente os selecionados'],state='readonly',width=27)
        self.scope_choice.pack(side='left');self.scope_choice.bind('<<ComboboxSelected>>',lambda _event:self.update_buttons())
        self.filters=Fold(saved,'Buscar ou filtrar posts')
        self.state_filter=tk.StringVar(value='Todas');self.search=tk.StringVar()
        ttk.Combobox(self.filters.body,textvariable=self.state_filter,values=list(FILTERS),state='readonly',width=18).pack(side='left',padx=(0,10))
        ttk.Entry(self.filters.body,textvariable=self.search).pack(side='left',fill='x',expand=True)
        self.state_filter.trace_add('write',lambda *_:self.render_rows());self.search.trace_add('write',lambda *_:self.render_rows())
        self.backups=Fold(frame,'Análises anteriores, restaurar ou salvar relatório')
        historyrow=ttk.Frame(self.backups.body,style='Card.TFrame');historyrow.pack(fill='x')
        ttk.Label(historyrow,text='Análise salva',style='Card.TLabel').pack(side='left',padx=(0,10))
        self.history=ttk.Combobox(historyrow,state='readonly');self.history.pack(side='left',fill='x',expand=True);self.history.bind('<<ComboboxSelected>>',self.choose)
        ttk.Button(historyrow,text='Atualizar lista',command=self.refresh,style='Quiet.TButton').pack(side='right',padx=(8,0))
        actions=ttk.Frame(self.backups.body,style='Card.TFrame');actions.pack(fill='x',pady=8)
        self.restore_button=ttk.Button(actions,text='Restaurar textos originais',command=lambda:self.apply(True));self.restore_button.pack(side='left')
        ttk.Button(actions,text='Salvar relatório CSV',command=self.export_report,style='Quiet.TButton').pack(side='left',padx=8)
        ttk.Label(self.backups.body,text='Ctrl ou Shift selecionam vários posts. Filtros só mudam a lista visível. A restauração usa o backup e preserva posts alterados depois da prévia.',style='CardMuted.TLabel',wraplength=900).pack(anchor='w')
        self.refresh()
        for variable in (self.channel,self.target,self.ads,self.plain):variable.trace_add('write',lambda *_:self.update_buttons())

    def inputs(self):
        return (self.channel_refs.get(self.channel.get(),self.channel.get()).strip(),self.target.get().strip(),self.ads.get(),self.plain.get())

    def load_batch_inputs(self):
        batch=self.editor.db.batch(self.batch_id)
        self.channel.set(batch['channel']);self.target.set(batch['target']);self.ads.set(False);self.plain.set(False)
        self.ready_inputs=self.inputs()

    def stop(self):
        self.editor.cancel.set();self.window.notify('Pausa solicitada. A edição em andamento pode terminar antes da pausa.')

    def channels(self):
        def loaded(channels):
            self.channel_refs={f'{title} | {reference}':reference for reference,title in channels}
            self.channel_choice.configure(values=list(self.channel_refs))
            self.window.notify('Escolha seu canal na lista.' if channels else 'Nenhum canal com permissão de edição foi encontrado nesta conta.')
            if channels:self.channel_choice.focus_set()
        self.window.dispatch(self.editor.channels(),loaded)

    def scan(self):
        if self.window.busy:self.window.notify('Aguarde a operação atual.');return
        if not self.window.store.setting('account'):
            self.window.login();self.window.notify('Conecte sua conta acima. Depois clique em Ver prévia.');return
        self.scanning_inputs=self.inputs();self.operation='scan';self.progress.configure(mode='indeterminate');self.progress.start(20)
        self.window.dispatch(self.editor.scan(self.channel_refs.get(self.channel.get(),self.channel.get()),self.target.get(),self.ads.get(),self.plain.get()),self.complete)

    def complete(self,batch_id):
        scanning=self.operation=='scan'
        self.batch_id=batch_id
        if scanning:self.ready_inputs=self.scanning_inputs
        elif self.ready_inputs is None:self.load_batch_inputs()
        self.operation=None;self.progress.stop();self.progress.configure(mode='determinate')
        self.refresh();self.window.notify(self.editor.db.batch(batch_id)['note'])

    def choose(self,_event=None):
        if self.window.busy:return
        if self.history.current()<0:return
        self.batch_id=self.ids[self.history.current()];self.operation=None;self.load_batch_inputs();self.search.set('');self.state_filter.set('Todas');self.refresh()

    def refresh(self):
        batches=self.editor.db.batches();self.ids=[b['id'] for b in batches]
        self.history.configure(values=[f"#{b['id']} · {b['title']}" for b in batches])
        if self.batch_id is None and batches:
            self.batch_id=batches[0]['id'];self.load_batch_inputs()
        if self.batch_id in self.ids:
            self.history.current(self.ids.index(self.batch_id))
            self.items={str(i['message_id']):i for i in self.editor.db.items(self.batch_id)}
        if not self.window.busy:
            self.operation=None;self.progress.stop();self.progress.configure(mode='determinate')
        self.render_rows();self.refresh_progress();self.update_buttons()

    def render_rows(self):
        selected=self.tree.selection();state=FILTERS[self.state_filter.get()];query=self.search.get().strip().casefold()
        visible=[]
        for key,item in self.items.items():
            text=json.loads(item['original'])['text']
            if (state is None or item['status']==state) and (not query or query in (key+' '+text).casefold()):visible.append((key,item,text))
        ids={key for key,_,_ in visible}
        for iid in self.tree.get_children():
            if iid not in ids:self.tree.delete(iid)
        for key,item,text in visible:
            values=(key,STATES[item['status']],len(json.loads(item['links'])),text.replace('\n',' ')[:180])
            if self.tree.exists(key):self.tree.item(key,values=values,tags=(item['status'],))
            else:self.tree.insert('','end',iid=key,values=values,tags=(item['status'],))
        keep=[key for key in selected if self.tree.exists(key)]
        if keep:self.tree.selection_set(keep)
        self.list_caption.set(f'{len(visible)} de {len(self.items)} posts. Clique para conferir; Ctrl ou Shift para selecionar vários.' if self.items else 'Nenhuma proposta nesta lista. Analise o canal ou confira os filtros.')
        self.details()

    def refresh_progress(self):
        if self.operation=='scan' and self.window.busy:
            batches=self.editor.db.batches()
            if batches and batches[0]['status']=='scanning':
                if self.batch_id!=batches[0]['id']:
                    self.batch_id=batches[0]['id'];self.items={};self.render_rows()
        if self.batch_id is None:return
        batch=self.editor.db.batch(self.batch_id);states=self.editor.db.states(self.batch_id)
        counts={state:sum(i['status']==state for i in states) for state in STATES}
        for key,metric in self.stats.items():metric.value.set(readable_count(counts[key]))
        self.summary.set(f"{batch['title']} · {batch['channel']} → {batch['target']}\n{BATCH_STATES[batch['status']]} · {readable_count(batch['scanned'])} posts analisados")
        if batch['status']=='scanning':
            self.progress_text.set(f"Analisando o histórico… {readable_count(len(states))} propostas encontradas. O total ainda está sendo descoberto.")
        else:
            pending_state='applied' if self.operation=='restore' else 'pending'
            remaining=sum(item['status']==pending_state and item['message_id'] in self.run_ids for item in states) if self.operation in ('apply','restore') else counts['pending']
            total=self.run_total if self.operation in ('apply','restore') else len(states)
            finished=max(0,total-remaining)
            self.progress.configure(value=100*finished/total if total else 0)
            self.progress_text.set(f"{readable_count(finished)} de {readable_count(total)} propostas conferidas nesta operação.")
        changed=False
        for state in states:
            key=str(state['message_id'])
            if key in self.items and any(self.items[key][field]!=state[field] for field in ('status','note')):
                self.items[key].update(state);changed=True
        if changed:self.render_rows()
        wait=max(0,int(batch['wait_until']-time.time())+1)
        if wait:self.apply_caption.set(f'Limite do Telegram: aguarde {wait} segundos antes de retomar.')
        elif batch['status']=='incomplete':self.apply_caption.set('A análise foi interrompida. Analise o histórico novamente antes de aplicar.')
        elif counts['pending']:self.apply_caption.set(f"{readable_count(counts['pending'])} posts aguardam aplicação. Revise a prévia antes de confirmar.")
        elif counts['applied']:self.apply_caption.set('Alterações aplicadas. Você pode restaurar os originais enquanto os posts não tiverem novas mudanças.')
        else:self.apply_caption.set('Nenhuma alteração pendente nesta análise.')
        self.update_buttons()

    def update_buttons(self):
        busy=self.window.busy
        if self.batch_id is None:
            self.preview_card.master.pack_forget()
        else:
            self.empty_preview.pack_forget();self.preview_card.master.pack(fill='x',pady=(0,16),before=self.backups)
        for button in (self.channels_button,self.scan_button):button.configure(state='disabled' if busy else 'normal')
        self.stop_button.configure(state='normal' if busy and self.operation else 'disabled')
        self.history.configure(state='disabled' if busy else 'readonly')
        if hasattr(self,'scope_choice'):self.scope_choice.configure(state='disabled' if busy else 'readonly')
        batch=self.editor.db.batch(self.batch_id) if self.batch_id is not None else None
        ready=batch is not None and batch['status'] not in ('scanning','incomplete') and batch['wait_until']<=time.time() and not busy
        states=self.editor.db.states(self.batch_id) if batch else []
        if hasattr(self,'scope') and self.scope.get()=='Somente os selecionados':
            selection={int(key) for key in self.tree.selection()}
            states=[item for item in states if item['message_id'] in selection]
        self.apply_button.configure(state='normal' if ready and any(i['status']=='pending' for i in states) else 'disabled')
        self.restore_button.configure(state='normal' if ready and any(i['status']=='applied' for i in states) else 'disabled')
        same=self.ready_inputs==self.inputs()
        if not same:
            self.apply_button.configure(state='disabled')
            if batch and not busy:self.apply_caption.set('Você alterou os campos. Clique em Ver prévia para preparar uma nova análise.')
        self.scan_button.configure(text='Analisar novamente' if batch and same else '1. Ver prévia',style='Quiet.TButton' if batch and same else 'Primary.TButton')
        if batch and same:self.apply_button.pack(side='left',padx=8)
        else:self.apply_button.pack_forget()
        if busy and self.operation:self.stop_button.pack(side='left',padx=8)
        else:self.stop_button.pack_forget()
        for control in [self.channel_choice,self.target_entry,*self.option_controls]:control.configure(state='disabled' if busy else 'normal')


    def selection_changed(self,_event=None):
        self.details();self.update_buttons()

    def export_report(self):
        if self.batch_id is None:
            self.window.notify('Analise um canal primeiro.');return
        path=filedialog.asksaveasfilename(parent=self.window.root,title='Salvar relatório da análise',defaultextension='.csv',initialfile=f'telegram-analise-{self.batch_id}.csv',filetypes=[('Relatório CSV','*.csv')])
        if not path:return
        try:
            export_edit_report(path,self.editor.db.batch(self.batch_id),self.editor.db.items(self.batch_id))
            self.window.notify('Relatório salvo neste computador. O arquivo não inclui credenciais nem os textos completos dos posts.')
        except OSError:self.window.notify('Não foi possível salvar o relatório. Confira a pasta escolhida.',True)

    def details(self,_event=None):
        selected=self.tree.selection()
        before='Selecione uma publicação na lista para ver o texto original.'
        after='A proposta aparecerá aqui, junto com o novo destino de cada link.'
        note='Confira os textos e os links antes de aplicar.'
        if selected and selected[0] in self.items:
            item=self.items[selected[0]];original=json.loads(item['original']);desired=json.loads(item['desired'])
            def describe(value):
                links=[entity.url for entity in decode_entities(value['entities']) if hasattr(entity,'url')]
                return value['text']+'\n\nDESTINOS DOS LINKS\n'+('\n'.join(links) if links else 'Sem links embutidos.')
            before=describe(original);after=describe(desired)
            note=f"Post {item['message_id']} · {STATES[item['status']]}"+(' · '+item['note'] if item['note'] else '')
        for widget,text in ((self.original_text,before),(self.detail,after)):
            widget.configure(state='normal');widget.delete('1.0','end');widget.insert('1.0',text);widget.configure(state='disabled')
        self.selected_note.set(note)

    def apply(self,restore=False):
        if self.window.busy:self.window.notify('Aguarde a operação atual.');return
        try:
            if self.batch_id is None:raise UserError('Veja a prévia primeiro.')
            if not restore and self.ready_inputs!=self.inputs():raise UserError('Os campos mudaram. Veja uma nova prévia antes de aplicar.')
            batch=self.editor.db.batch(self.batch_id)
            if batch['status'] in ('scanning','incomplete'):raise UserError('Faça uma nova análise: esta foi interrompida.')
            selected=[int(key) for key in self.tree.selection()] if self.scope.get()=='Somente os selecionados' else None
            if selected is not None and not selected:raise UserError('Selecione os posts na lista ou escolha Toda a análise.')
            items=[i for i in self.editor.db.states(self.batch_id) if i['status']==('applied' if restore else 'pending') and (selected is None or i['message_id'] in selected)]
            if not items:raise UserError('Não há publicações elegíveis para esta operação nesta análise.')
            action='Restaurar os textos originais de' if restore else 'Editar os links e textos de'
            prompt=f"{action} {len(items)} publicações?\n\nCanal: {batch['title']}\nID: {batch['channel']}\nNovo destino: {batch['target']}\n\nA operação usará a prévia salva desta análise. Posts modificados desde a prévia serão ignorados. Escopo: {self.scope.get()}. Nenhuma publicação será apagada."
            if messagebox.askyesno('Confirmar restauração' if restore else 'Confirmar edição no Telegram',prompt,parent=self.window.root):
                self.operation='restore' if restore else 'apply';self.run_total=len(items);self.run_ids={item['message_id'] for item in items}
                self.window.dispatch(self.editor.apply(self.batch_id,restore,selected),self.complete)
        except UserError as reason:self.window.notify(str(reason),True)
