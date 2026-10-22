import json
import time
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from .editor import DEFAULT_URL, decode_entities
from .domain import UserError
from .reports import export_edit_report
from .design import BLUE, GREEN, AMBER, MUTED, RED, ScrollPage, heading, card, metrics, text_box, table, readable_count

STATES={'pending':'Pendente','applied':'Editado','restored':'Restaurado','conflict':'Ignorado: mudou após a prévia'}
FILTERS={'Todas':None,'Pendentes':'pending','Editadas':'applied','Restauradas':'restored','Ignoradas':'conflict'}
BATCH_STATES={'scanning':'Analisando o histórico','ready':'Prévia pronta para conferir','incomplete':'Análise incompleta · faça uma nova análise','applying':'Operação em andamento','paused':'Operação pausada','done':'Operação finalizada'}


class EditorTab:
    def __init__(self,window,notebook):
        self.window=window;self.editor=window.runtime.engine.editor
        self.batch_id=None;self.channel_refs={};self.items={};self.operation=None;self.run_total=0;self.run_ids=set()
        self.frame=ScrollPage(notebook);notebook.add(self.frame,text='editor');frame=self.frame.inner
        heading(frame,'Alterar publicações existentes','Editor de links do canal','Escolha seu canal, confira a prévia e aplique. Os textos clicáveis e as mídias são preservados.')
        self.stats=metrics(frame,[('pending','Pendentes','Propostas a aplicar',AMBER),('applied','Editadas','Alterações confirmadas',GREEN),('restored','Restauradas','Textos originais recuperados',BLUE),('conflict','Ignoradas','Mudaram após a prévia',MUTED)])
        config=card(frame,'1. Escolha o canal e o novo link','Você precisa ser dono do canal ou ter permissão para editar mensagens.')
        self.channel=tk.StringVar();self.target=tk.StringVar(value=DEFAULT_URL)
        ttk.Label(config,text='Canal que você administra',style='Card.TLabel').pack(anchor='w')
        row=ttk.Frame(config,style='Card.TFrame');row.pack(fill='x',pady=(5,12))
        self.channel_choice=ttk.Combobox(row,textvariable=self.channel);self.channel_choice.pack(side='left',fill='x',expand=True)
        self.channels_button=ttk.Button(row,text='Meus canais',command=self.channels);self.channels_button.pack(side='right',padx=(10,0))
        ttk.Label(config,text='Novo destino dos links',style='Card.TLabel').pack(anchor='w')
        ttk.Entry(config,textvariable=self.target).pack(fill='x',pady=(5,8))
        self.ads=tk.BooleanVar(value=False);self.plain=tk.BooleanVar(value=False)
        ttk.Checkbutton(config,text='Remover as linhas “outros grupos” e “Hentai”, preservando o post',variable=self.ads).pack(anchor='w')
        ttk.Checkbutton(config,text='Também trocar o destino das URLs escritas por extenso',variable=self.plain).pack(anchor='w')
        ttk.Label(config,text='Por padrão, troca links embutidos (Ctrl+K). O texto visível é mantido. Posts com botões e menções não são alterados.',style='CardMuted.TLabel',wraplength=700).pack(anchor='w',pady=(8,10))
        actionrow=ttk.Frame(config,style='Card.TFrame');actionrow.pack(fill='x')
        self.scan_button=ttk.Button(actionrow,text='Analisar todo o histórico',style='Primary.TButton',command=self.scan);self.scan_button.pack(side='left')
        self.stop_button=ttk.Button(actionrow,text='Pausar operação',command=self.stop);self.stop_button.pack(side='left',padx=8)
        ttk.Label(config,text='Analisar prepara uma prévia. Nenhum post é alterado nesta etapa.',style='CardMuted.TLabel').pack(anchor='w',pady=(10,0))
        saved=card(frame,'2. Confira as alterações','Selecione uma publicação para comparar o texto original e a proposta abaixo da lista.')
        historyrow=ttk.Frame(saved,style='Card.TFrame');historyrow.pack(fill='x')
        ttk.Label(historyrow,text='Análise salva',style='Card.TLabel').pack(side='left',padx=(0,10))
        self.history=ttk.Combobox(historyrow,state='readonly');self.history.pack(side='left',fill='x',expand=True);self.history.bind('<<ComboboxSelected>>',self.choose)
        ttk.Button(historyrow,text='Atualizar',command=self.refresh,style='Quiet.TButton').pack(side='right',padx=(8,0))
        self.summary=tk.StringVar(value='Ainda não há uma análise. Escolha um canal acima para começar.')
        ttk.Label(saved,textvariable=self.summary,style='CardMuted.TLabel',wraplength=700,justify='left').pack(anchor='w',pady=12)
        self.progress=ttk.Progressbar(saved,mode='determinate');self.progress.pack(fill='x',pady=(0,6))
        self.progress_text=tk.StringVar(value='A análise percorre o histórico sem alterar publicações.')
        ttk.Label(saved,textvariable=self.progress_text,style='CardMuted.TLabel',wraplength=700).pack(anchor='w',pady=(0,10))
        filters=ttk.Frame(saved,style='Card.TFrame');filters.pack(fill='x')
        self.state_filter=tk.StringVar(value='Todas');self.search=tk.StringVar()
        ttk.Combobox(filters,textvariable=self.state_filter,values=list(FILTERS),state='readonly',width=18).pack(side='left',padx=(0,10))
        ttk.Entry(filters,textvariable=self.search).pack(side='left',fill='x',expand=True)
        self.tree=table(saved,[('id','Post',65),('state','Situação',195),('links','Links alterados',100),('text','Texto / legenda',350)],height=6)
        self.tree.configure(selectmode='extended')
        self.tree.bind('<<TreeviewSelect>>',self.selection_changed)
        self.list_caption=tk.StringVar(value='A lista aparecerá depois da análise.')
        ttk.Label(saved,textvariable=self.list_caption,style='CardMuted.TLabel',wraplength=700).pack(anchor='w')
        self.state_filter.trace_add('write',lambda *_:self.render_rows());self.search.trace_add('write',lambda *_:self.render_rows())
        compare=card(frame,'Comparar publicação selecionada')
        columns=ttk.Frame(compare,style='Card.TFrame');columns.pack(fill='both',expand=True)
        for index,label in enumerate(('ORIGINAL','COMO VAI FICAR')):
            columns.columnconfigure(index,weight=1,uniform='preview')
            side=ttk.Frame(columns,style='Card.TFrame',padding=(0 if index==0 else 8,0,8 if index==0 else 0,0));side.grid(row=0,column=index,sticky='nsew')
            ttk.Label(side,text=label,style='CardMuted.TLabel').pack(anchor='w',pady=(0,8))
            widget=text_box(side,height=9,color=GREEN if index else MUTED);widget.configure(state='disabled')
            if index:self.detail=widget
            else:self.original_text=widget
        self.selected_note=tk.StringVar(value='Selecione um post na lista. As caixas mostram o texto e os destinos dos links.')
        ttk.Label(compare,textvariable=self.selected_note,style='CardMuted.TLabel',wraplength=700).pack(anchor='w',pady=(10,0))
        applybox=card(frame,'3. Aplique quando estiver pronto','Confira o canal e as propostas acima. A confirmação final mostra o destino e a quantidade de posts.')
        self.apply_caption=tk.StringVar(value='Primeiro analise o canal e confira a prévia.')
        ttk.Label(applybox,textvariable=self.apply_caption,style='CardMuted.TLabel',wraplength=700).pack(anchor='w',pady=(0,10))
        self.scope=tk.StringVar(value='Toda a análise')
        scope_row=ttk.Frame(applybox,style='Card.TFrame');scope_row.pack(fill='x',pady=(0,10))
        ttk.Label(scope_row,text='Aplicar ou restaurar:',style='Card.TLabel').pack(side='left',padx=(0,10))
        self.scope_choice=ttk.Combobox(scope_row,textvariable=self.scope,values=['Toda a análise','Somente os selecionados'],state='readonly',width=27)
        self.scope_choice.pack(side='left');self.scope_choice.bind('<<ComboboxSelected>>',lambda _event:self.update_buttons())
        ttk.Label(applybox,text='Para selecionar vários posts, use Ctrl ou Shift na lista. Busca e filtros mudam apenas a lista visível.',style='CardMuted.TLabel',wraplength=700).pack(anchor='w',pady=(0,10))
        ttk.Button(applybox,text='Salvar relatório CSV',command=self.export_report,style='Quiet.TButton').pack(anchor='w',pady=(0,10))
        actionrow=ttk.Frame(applybox,style='Card.TFrame');actionrow.pack(fill='x')
        self.apply_button=ttk.Button(actionrow,text='Aplicar alterações / retomar',style='Primary.TButton',command=self.apply);self.apply_button.pack(side='left')
        self.restore_button=ttk.Button(actionrow,text='Restaurar originais',command=lambda:self.apply(True));self.restore_button.pack(side='left',padx=(10,0))
        ttk.Label(applybox,text='A restauração usa o backup salvo neste Windows. Posts alterados depois da prévia são preservados como conflitos.',style='CardMuted.TLabel',wraplength=700).pack(anchor='w',pady=(10,0))
        self.refresh()

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
        self.operation='scan';self.progress.configure(mode='indeterminate');self.progress.start(20)
        self.window.dispatch(self.editor.scan(self.channel_refs.get(self.channel.get(),self.channel.get()),self.target.get(),self.ads.get(),self.plain.get()),self.complete)

    def complete(self,batch_id):
        self.batch_id=batch_id;self.operation=None;self.progress.stop();self.progress.configure(mode='determinate')
        self.refresh();self.window.notify(self.editor.db.batch(batch_id)['note'])

    def choose(self,_event=None):
        if self.window.busy:return
        if self.history.current()<0:return
        self.batch_id=self.ids[self.history.current()];self.operation=None;self.refresh()

    def refresh(self):
        batches=self.editor.db.batches();self.ids=[b['id'] for b in batches]
        self.history.configure(values=[f"#{b['id']} · {b['title']}" for b in batches])
        if self.batch_id is None and batches:self.batch_id=batches[0]['id']
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
        self.list_caption.set(f'{len(visible)} de {len(self.items)} propostas na lista. Busque pelo texto ou número do post no campo acima.' if self.items else 'Nenhuma proposta nesta lista. Analise o canal ou confira os filtros.')
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
        self.summary.set(f"{batch['title']} · {batch['channel']}\nDestino: {batch['target']}\n{BATCH_STATES[batch['status']]} · {readable_count(batch['scanned'])} publicações analisadas\n{batch['note']}")
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
            if self.batch_id is None:raise UserError('Analise o canal primeiro.')
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
