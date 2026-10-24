import json
import tkinter as tk
import webbrowser
from datetime import datetime
from tkinter import ttk, messagebox
from .domain import UserError, replace
from .runtime import Runtime
from .branding import brand_image
from .design import BG, SIDEBAR, CARD, BORDER, TEXT, MUTED, BLUE, GREEN, AMBER, RED
from .design import theme, ScrollPage, heading, card, metrics, text_box, table, readable_count, Fold

LABELS={'paused':'Pausada','running':'Em execução','completed':'Concluída','cancelled':'Cancelada','attention':'Precisa de atenção'}
FILTERS={'Todas':None,'Em execução':'running','Pausadas':'paused','Concluídas':'completed','Precisam de atenção':'attention','Canceladas':'cancelled'}


class Window:
    def __init__(self,root,store):
        self.root,self.store=root,store
        self.runtime=Runtime(store)
        self.rules=json.loads(store.setting('rules') or '[]')
        self.busy=False;self.closing=False;self.login_dialog=None;self.task_dialog=None
        self.operation_buttons=[];self.job_counts={};self.jobs_data={};self.active_page='home'
        self.source=tk.StringVar();self.destination=tk.StringVar();self.mode=tk.StringVar(value='history');self.authorized=tk.BooleanVar()
        self.resolved=tk.StringVar();self.status=tk.StringVar(value='Conecte sua conta e escolha o que deseja fazer abaixo.')
        self.account=tk.StringVar(value='Conta salva neste Windows' if store.setting('account') else 'Telegram não conectado')
        root.title('Telegram Sync · 00duHot')
        width=max(980,min(1280,root.winfo_screenwidth()-80));height=max(640,min(900,root.winfo_screenheight()-140))
        root.geometry(f'{width}x{height}+16+8');root.minsize(980,640);theme(root)
        self.shell=ttk.Frame(root);self.shell.pack(fill='both',expand=True)
        top=ttk.Frame(self.shell,padding=(22,12));top.pack(fill='x')
        self.brand_mark=brand_image(40);root.iconphoto(True,self.brand_mark)
        ttk.Label(top,image=self.brand_mark).pack(side='left',padx=(0,10))
        ttk.Label(top,text='Telegram Sync',style='Heading.TLabel').pack(side='left')
        ttk.Label(top,text='00duHot · v0.5.2',style='Muted.TLabel').pack(side='left',padx=14)
        self.account_controls=ttk.Frame(top);self.account_controls.pack(side='right')
        ttk.Label(self.account_controls,textvariable=self.account,style='Muted.TLabel').pack(side='left',padx=12)
        self.connect_button=ttk.Button(self.account_controls,text='Conectar Telegram',style='Primary.TButton',command=self.login)
        self.disconnect_button=ttk.Button(self.account_controls,text='Desconectar',style='Quiet.TButton',command=self.disconnect)
        dashboard=ttk.Frame(self.shell,padding=(22,0,22,0));dashboard.pack(fill='x')
        self.home_metrics=metrics(dashboard,[('sent','Cópias publicadas','Mensagens confirmadas',GREEN),('running','Copiando agora','Sincronizações em execução',BLUE),('paused','Pausadas','Aguardando você iniciar',AMBER),('attention','Precisam de atenção','Confira antes de retomar',RED)],compact=True)
        footer=ttk.Frame(self.shell,padding=(22,10));footer.pack(side='bottom',fill='x')
        self.spinner=ttk.Progressbar(footer,mode='indeterminate',length=70)
        self.status_label=ttk.Label(footer,textvariable=self.status,style='Muted.TLabel',wraplength=900);self.status_label.pack(side='left',fill='x',expand=True)
        footer.bind('<Configure>',lambda e:self.status_label.configure(wraplength=max(200,e.width-160)))
        self.page=ScrollPage(self.shell,padding=(22,10,22,14));self.page.pack(fill='both',expand=True);body=self.page.inner
        self.login_section=Fold(body,'Conectar minha conta');self.login_section.pack_forget()
        self.operation_choice=tk.StringVar(value='copy')
        chooser=ttk.Frame(body);self.chooser=chooser;chooser.pack(fill='x',pady=(0,12))
        ttk.Label(chooser,text='O que você quer fazer?',style='Heading.TLabel').pack(side='left',padx=(0,18))
        self.mode_buttons={}
        for value,title in [('copy','Copiar para outro canal'),('edit','Trocar links do meu canal')]:
            button=ttk.Button(chooser,text=title,command=lambda v=value:self.show_operation(v));button.pack(side='left',padx=(0,8));self.mode_buttons[value]=button
        self.operation_host=ttk.Frame(body);self.operation_host.pack(fill='x')
        self.copy_panel=ttk.Frame(self.operation_host)
        self.build_copy_form(self.copy_panel)
        self.build_tasks(self.copy_panel)
        self.rules_section=Fold(self.copy_panel,'Trocar textos e links nas próximas cópias (opcional)')
        self.build_rules(self.rules_section.body)
        from .editor_ui import EditorTab
        self.editor_tab=EditorTab(self,self.operation_host)
        self.activity_section=Fold(body,'Histórico e ajuda')
        self.build_activity(self.activity_section.body)
        self.reload_rules();self.reload();self.show_operation('copy');self.update_buttons()
        self.poll_id=root.after(150,self.poll);self.tick_id=root.after(1000,self.tick)
        root.protocol('WM_DELETE_WINDOW',self.close)

    def button(self,parent,text,command,primary=False,side='left'):
        button=ttk.Button(parent,text=text,command=command,style='Primary.TButton' if primary else 'TButton')
        button.pack(side=side,padx=(0,8),pady=4)
        self.operation_buttons.append(button)
        return button

    def scroll_to(self, widget):
        self.root.update_idletasks()
        content=self.page.canvas.bbox('all')
        if content:
            offset=widget.winfo_rooty()-self.page.inner.winfo_rooty()
            self.page.canvas.yview_moveto(max(0,offset)/max(1,content[3]))

    def show_operation(self, value):
        self.operation_choice.set(value)
        self.copy_panel.pack_forget();self.editor_tab.frame.pack_forget()
        (self.copy_panel if value=='copy' else self.editor_tab.frame).pack(fill='x')
        for key,button in self.mode_buttons.items():button.configure(style='Primary.TButton' if key==value else 'TButton')
        self.active_page='tasks' if value=='copy' else 'editor'

    def navigate(self,key):
        if key in ('home','tasks','rules'):self.show_operation('copy')
        elif key=='editor':self.show_operation('edit')
        if key=='rules':self.rules_section.set_open(True);self.scroll_to(self.rules_section)
        elif key=='activity':self.activity_section.set_open(True);self.scroll_to(self.activity_section)
        elif key=='tasks':self.scroll_to(self.tasks_card)
        else:self.page.canvas.yview_moveto(0)

    def build_copy_form(self,parent):
        self.copy_form=card(parent,'Copiar publicações','Informe de onde copiar e onde publicar. Aceita @nome, link t.me ou ID do canal.')
        fields=ttk.Frame(self.copy_form,style='Card.TFrame');fields.pack(fill='x')
        for index,(label,var) in enumerate([('De qual canal?',self.source),('Para qual canal?',self.destination)]):
            fields.columnconfigure(index,weight=1,uniform='copy')
            block=ttk.Frame(fields,style='Card.TFrame',padding=(0,0,10 if index==0 else 0,0));block.grid(row=0,column=index,sticky='ew')
            ttk.Label(block,text=label,style='Card.TLabel').pack(anchor='w');ttk.Entry(block,textvariable=var).pack(fill='x',pady=(5,8))
        self.copy_options=Fold(self.copy_form,'Continuar copiando novos posts (opcional)')
        ttk.Checkbutton(self.copy_options.body,text='Copiar o histórico e continuar acompanhando novas publicações',variable=self.mode,onvalue='continuous',offvalue='history').pack(anchor='w')
        ttk.Label(self.copy_options.body,text='Desmarcado: copia apenas o histórico existente. O aplicativo precisa continuar aberto.',style='CardMuted.TLabel').pack(anchor='w')
        ttk.Checkbutton(self.copy_form,text='Tenho autorização para copiar o conteúdo deste canal.',variable=self.authorized).pack(anchor='w')
        create_row=ttk.Frame(self.copy_form,style='Card.TFrame');create_row.pack(fill='x')
        self.create_button=self.button(create_row,'Criar sincronização',self.create,True)
        ttk.Label(self.copy_form,text='Os canais são verificados ao criar. A cópia fica pausada até você clicar em Iniciar.',style='CardMuted.TLabel',wraplength=900).pack(anchor='w',pady=(6,0))

    def build_tasks(self,parent):
        filters=card(parent,'Suas sincronizações');self.tasks_card=filters
        self.task_filter=tk.StringVar(value='Todas');self.search=tk.StringVar()
        controls=ttk.Frame(filters,style='Card.TFrame');controls.pack(fill='x')
        self.start_button=self.button(controls,'Iniciar cópia',lambda:self.control('start'),True)
        self.pause_button=self.button(controls,'Pausar',lambda:self.control('pause'))
        self.recover_button=self.button(controls,'Conferir envio',self.recover)
        self.jobs=table(filters,[('source','Origem',230),('destination','Destino',230),('status','Situação',170),('sent','Publicadas',90),('pending','A conferir',85)],height=3)
        self.jobs.bind('<<TreeviewSelect>>',lambda _event:self.details())
        self.task_extra=Fold(filters,'Buscar, filtrar ou cancelar uma tarefa')
        toolbar=ttk.Frame(self.task_extra.body,style='Card.TFrame');toolbar.pack(fill='x');toolbar.columnconfigure(1,weight=1)
        ttk.Combobox(toolbar,textvariable=self.task_filter,values=list(FILTERS),state='readonly',width=23).grid(row=0,column=0,sticky='w',padx=(0,12))
        ttk.Entry(toolbar,textvariable=self.search).grid(row=0,column=1,sticky='ew')
        self.cancel_button=self.button(self.task_extra.body,'Cancelar tarefa selecionada',lambda:self.control('cancel'))
        self.tasks_empty=tk.StringVar();ttk.Label(filters,textvariable=self.tasks_empty,style='CardMuted.TLabel',wraplength=900).pack(anchor='w')
        self.task_filter.trace_add('write',lambda *_:self.reload());self.search.trace_add('write',lambda *_:self.reload())
        self.detail=tk.StringVar(value='Selecione uma sincronização na lista para acompanhar.')
        ttk.Label(filters,textvariable=self.detail,style='CardMuted.TLabel',wraplength=900,justify='left').pack(anchor='w',pady=(10,0))
        self.task_progress=ttk.Progressbar(filters,mode='indeterminate')

    def new_task(self):
        if self.busy:self.notify('Aguarde a operação atual.');return
        self.show_operation('copy');self.scroll_to(self.copy_form)

    def build_rules(self,parent):
        heading(parent,'Personalize as próximas cópias','Substituições de texto e links','Estas regras valem para novas sincronizações. Para alterar posts que já existem, use Editar links.')
        form=card(parent,'1. Crie uma regra','Escreva exatamente o texto que deve mudar. Deixe o substituto vazio se quiser remover esse trecho.')
        self.find=tk.StringVar();self.replacement=tk.StringVar()
        for title,var in [('Encontrar este texto ou link',self.find),('Trocar por',self.replacement)]:
            ttk.Label(form,text=title,style='Card.TLabel').pack(anchor='w',pady=(6,4));ttk.Entry(form,textvariable=var).pack(fill='x')
        ttk.Button(form,text='+ Adicionar regra',style='Primary.TButton',command=self.add_rule).pack(anchor='w',pady=(12,0))
        listing=card(parent,'Regras salvas','Tarefas já criadas mantêm as regras que tinham no momento da criação.')
        self.rules_tree=table(listing,[('find','Encontrar',330),('replacement','Trocar por',330)],height=3)
        ttk.Button(listing,text='Remover regra selecionada',command=self.remove_rule,style='Quiet.TButton').pack(anchor='w')
        sample=card(parent,'2. Teste antes de usar','Cole uma legenda e veja como ela ficará com as regras acima.')
        self.sample=text_box(sample,height=4)
        ttk.Button(sample,text='Ver resultado',command=self.preview,style='Primary.TButton').pack(anchor='w',pady=10)
        ttk.Label(sample,text='RESULTADO DA PRÉVIA',style='CardMuted.TLabel').pack(anchor='w',pady=(0,6))
        self.preview_text=text_box(sample,height=4,color=GREEN);self.preview_text.configure(state='disabled')

    def build_activity(self,parent):
        heading(parent,'Histórico e orientações','Atividade e ajuda','Consulte o que aconteceu e encontre as orientações para continuar.')
        events=card(parent,'Últimos acontecimentos','Horários mostrados no fuso deste computador. O histórico não inclui o conteúdo das mensagens.')
        self.activity=text_box(events,height=10);self.activity.configure(state='disabled')
        helpbox=card(parent,'Como usar o Telegram Sync')
        for title,text in [
            ('Copiar para outro canal','Crie uma sincronização, confira origem e destino e clique em Iniciar. Pausar interrompe os próximos envios; uma publicação em andamento pode terminar.'),
            ('Editar links existentes','Escolha seu canal, analise o histórico e revise a prévia. Só depois aplique as alterações. Os textos originais ficam disponíveis para restauração.'),
            ('Entender os números','Publicadas são mensagens confirmadas. Ignoradas incluem mensagens de serviço ou vazias. A conferir são envios sem confirmação; confira o destino antes de decidir um reenvio.'),
            ('Fechar e retomar','Ao fechar, as operações param. Ao reabrir, você escolhe quando retomar. Mantenha o computador ligado e o aplicativo aberto durante o uso.'),
            ('Sua conta e seus dados','A sessão é protegida pelo usuário do Windows. Código e senha de duas etapas não são salvos. Para revogar o acesso, desconecte ou use Telegram > Configurações > Dispositivos.'),
            ('Limites da sincronização','A cópia exige autorização e respeita proteção de conteúdo. Não transfere membros, reações, tópicos ou edições posteriores. Na cópia, a formatação vira texto simples; a edição no próprio canal preserva a formatação.')]:
            ttk.Label(helpbox,text=title,style='CardHeading.TLabel').pack(anchor='w',pady=(12,4))
            label=ttk.Label(helpbox,text=text,style='CardMuted.TLabel',wraplength=700,justify='left');label.pack(anchor='w')
            helpbox.bind('<Configure>',lambda e,w=label:w.configure(wraplength=max(300,e.width-40)),add='+')
        ttk.Label(parent,text='Dados neste computador: '+str(self.store.path),style='Muted.TLabel',wraplength=740).pack(anchor='w',pady=(0,12))

    def notify(self,text,error=False):
        self.status.set(text)
        if error:messagebox.showerror('Telegram Sync',text,parent=self.root)

    def update_buttons(self):
        for button in self.operation_buttons:
            if button.winfo_exists():button.configure(state='disabled' if self.busy else 'normal')
        self.operation_buttons=[b for b in self.operation_buttons if b.winfo_exists()]
        saved=bool(self.store.setting('account'))
        self.connect_button.configure(state='disabled' if self.busy or saved else 'normal')
        self.disconnect_button.configure(state='normal' if saved and not self.busy else 'disabled')
        if saved:
            self.connect_button.pack_forget();self.disconnect_button.pack(side='left')
        else:
            self.disconnect_button.pack_forget();self.connect_button.pack(side='left')
        for button in self.mode_buttons.values():button.configure(state='disabled' if self.busy else 'normal')
        if self.login_dialog and self.login_dialog.winfo_exists():
            self.login_cancel.configure(state='disabled' if self.busy else 'normal')
        self.details()
        if hasattr(self,'editor_tab'):self.editor_tab.update_buttons()

    def dispatch(self,coro,callback=None):
        if self.busy:coro.close();self.notify('Aguarde a operação atual.');return
        self.busy=True;self.spinner.pack(side='right',padx=(16,0));self.spinner.start(12);self.status.set('Operação em andamento. Acompanhe o progresso nesta janela…');self.update_buttons()
        self.runtime.submit(coro,callback)

    def poll(self):
        while not self.runtime.events.empty():
            kind,value,callback=self.runtime.events.get_nowait()
            if kind in ('result','error'):
                self.busy=False;self.spinner.stop();self.spinner.pack_forget()
            if kind=='error':
                self.notify(value,error=True);self.editor_tab.refresh()
                if self.login_dialog and self.login_dialog.winfo_exists():self.login_submit.configure(state='normal')
            elif kind=='result':
                self.status.set('Operação concluída.')
                if callback:callback(value)
                self.reload();self.editor_tab.refresh()
            elif kind=='editor_progress':
                self.status.set(value);self.editor_tab.refresh_progress()
            elif kind=='account':self.account.set(value)
            elif kind=='refresh':self.reload()
            self.update_buttons()
        if not self.closing:self.poll_id=self.root.after(150,self.poll)

    def tick(self):
        if self.closing:return
        if self.editor_tab.batch_id is not None:self.editor_tab.refresh_progress()
        self.tick_id=self.root.after(1000,self.tick)

    def login(self):
        if self.busy:return
        if self.store.setting('account'):
            self.notify('Sua conta já está salva neste Windows.');return
        if self.login_dialog and self.login_dialog.winfo_exists():
            self.login_section.set_open(True);self.scroll_to(self.login_section);return
        self.login_section.pack(fill='x',before=self.chooser)
        self.login_section.set_open(True)
        box=ttk.Frame(self.login_section.body,style='Card.TFrame');box.pack(fill='x');self.login_dialog=box
        ttk.Label(box,text='Primeiro acesso: informe os dados do seu aplicativo Telegram. Depois você não precisa repeti-los.',style='CardMuted.TLabel',wraplength=900).pack(anchor='w',pady=(0,6))
        ttk.Button(box,text='Obter API ID e API Hash gratuitamente',style='Quiet.TButton',command=lambda:webbrowser.open('https://my.telegram.org')).pack(anchor='w')
        self.login_vars={name:tk.StringVar() for name in ('api_id','api_hash','phone','code','password')}
        self.login_entries={};self.login_rows={}
        for name,label in [('api_id','API ID'),('api_hash','API Hash'),('phone','Telefone com +55'),('code','Código recebido no Telegram'),('password','Senha de duas etapas')]:
            row=ttk.Frame(box,style='Card.TFrame');self.login_rows[name]=row
            if name not in ('code','password'):row.pack(fill='x',pady=3)
            ttk.Label(row,text=label,width=28,style='Card.TLabel').pack(side='left')
            entry=ttk.Entry(row,textvariable=self.login_vars[name],show='•' if name in ('api_hash','code','password') else '')
            entry.pack(side='left',fill='x',expand=True);self.login_entries[name]=entry
            if name in ('code','password'):entry.configure(state='disabled')
        self.login_stage='start'
        actions=ttk.Frame(box,style='Card.TFrame');actions.pack(fill='x',pady=8);self.login_actions=actions
        self.login_submit=ttk.Button(actions,text='Receber código',style='Primary.TButton',command=self.login_step);self.login_submit.pack(side='left')
        self.login_cancel=ttk.Button(actions,text='Cancelar conexão',command=self.cancel_login);self.login_cancel.pack(side='left',padx=8)
        self.login_hint=tk.StringVar(value='O código e a senha de duas etapas só aparecem quando o Telegram solicitar.')
        ttk.Label(box,textvariable=self.login_hint,style='CardMuted.TLabel',wraplength=900).pack(anchor='w')
        self.scroll_to(self.login_section)

    def cancel_login(self):
        if self.busy:return
        for value in self.login_vars.values():value.set('')
        self.login_dialog.destroy();self.login_dialog=None;self.login_section.pack_forget()
        self.dispatch(self.runtime.engine.abort_login())

    def login_step(self):
        if self.busy: return
        self.login_submit.configure(state='disabled')
        values={key:value.get() for key,value in self.login_vars.items()}
        def complete(stage):
            if not self.login_dialog or not self.login_dialog.winfo_exists(): return
            self.login_submit.configure(state='normal')
            if stage=='connected':
                for value in self.login_vars.values(): value.set('')
                self.login_dialog.destroy();self.login_dialog=None;self.login_section.pack_forget()
                self.notify('Conta conectada e protegida neste Windows.');return
            self.login_stage=stage
            for name in ('api_id','api_hash','phone'):
                self.login_entries[name].configure(state='disabled');self.login_rows[name].pack_forget()
            self.login_rows['code'].pack_forget();self.login_rows['password'].pack_forget()
            self.login_rows['password' if stage=='password' else 'code'].pack(fill='x',pady=3,before=self.login_actions)
            self.login_entries['code'].configure(state='normal' if stage=='code' else 'disabled')
            self.login_entries['password'].configure(state='normal' if stage=='password' else 'disabled')
            self.login_vars['code'].set('');self.login_vars['password'].set('')
            self.login_hint.set('Digite o código recebido no Telegram.' if stage=='code' else 'Digite sua senha de verificação em duas etapas.')
            self.login_submit.configure(text='Confirmar login')
        if self.login_stage=='start':
            self.dispatch(self.runtime.engine.begin_login(values['api_id'],values['api_hash'],values['phone']),complete)
        else:
            self.login_vars['code'].set('');self.login_vars['password'].set('')
            self.dispatch(self.runtime.engine.finish_login(values['code'],values['password']),complete)

    def disconnect(self):
        if not self.store.setting('account'): return
        choice=messagebox.askyesnocancel('Desconectar','Cancele primeiro as tarefas pendentes.\n\nSIM: revogar a sessão no Telegram e remover a conta local.\nNÃO: apenas remover a conta local (use se a sessão já foi revogada ou estiver offline).\nCANCELAR: manter a conta.',parent=self.root)
        if choice is not None:
            self.dispatch(self.runtime.engine.disconnect(revoke=choice))

    def resolve(self):
        self.dispatch(self.runtime.engine.resolve(self.source.get(),self.destination.get()),lambda value:self.resolved.set(value))

    def create(self):
        if not self.store.setting('account'):
            self.login();self.notify('Conecte sua conta acima. Seus canais preenchidos serão mantidos.');return
        def done(job_id): self.task_created(job_id)
        self.dispatch(self.runtime.engine.create(self.source.get(),self.destination.get(),self.mode.get(),list(self.rules),self.authorized.get()),done)

    def selected(self):
        selected=self.jobs.selection()
        if not selected: raise UserError('Selecione uma tarefa.')
        return int(selected[0])

    def control(self,action):
        if self.busy:
            self.notify('Aguarde a operação atual.');return
        try:
            job_id=self.selected()
            if action=='cancel' and not messagebox.askyesno('Cancelar','Cancelar esta tarefa? Publicações já enviadas não serão apagadas.',parent=self.root): return
            self.store.control(job_id,action)
            self.reload()
            self.notify('Controle aplicado. Se houver um envio em andamento, ele será finalizado antes da pausa.')
        except UserError as reason: self.notify(str(reason),True)

    def recover(self):
        try:
            job_id=self.selected();pending=self.store.pending(job_id)
            if not pending: raise UserError('Não há envio sem confirmação. Corrija o acesso ou a configuração e clique em Iniciar para tentar novamente.')
            answer=messagebox.askyesnocancel('Conferir destino',f'Abra o canal de destino e confira as mensagens de origem {pending}.\n\nSIM: confirmei que todas foram publicadas; avançar sem reenviar.\nNÃO: confirmei que nenhuma foi publicada; autorizar nova tentativa.\nCANCELAR: ainda não sei ou apenas parte foi publicada.',parent=self.root)
            if answer is None: return
            if not answer and not messagebox.askyesno('Autorizar reenvio','Uma conferência incorreta pode duplicar publicações. Você confirmou que nenhuma mensagem desse lote chegou ao destino?',parent=self.root):return
            self.store.resolve_pending(job_id,'sent' if answer else 'retry');self.reload()
        except UserError as reason:self.notify(str(reason),True)

    def add_rule(self):
        from .domain import validate_rules
        try:
            self.rules=validate_rules(self.rules+[{'find':self.find.get(),'replacement':self.replacement.get()}])
            self.find.set('');self.replacement.set('');self.reload_rules()
        except UserError as reason:self.notify(str(reason),True)

    def remove_rule(self):
        selected=self.rules_tree.selection()
        if selected: self.rules.pop(int(selected[0]));self.reload_rules()

    def reload_rules(self):
        self.store.save_rules(self.rules)
        self.rules_tree.delete(*self.rules_tree.get_children())
        for index,rule in enumerate(self.rules):self.rules_tree.insert('', 'end',iid=str(index),values=(rule['find'],rule['replacement']))

    def preview(self):
        try:
            text=replace(self.sample.get('1.0','end-1c'),self.rules)
            self.preview_text.configure(state='normal');self.preview_text.delete('1.0','end');self.preview_text.insert('1.0',text);self.preview_text.configure(state='disabled')
        except UserError as reason:self.notify(str(reason),True)

    def task_created(self,job_id):
        self.authorized.set(False)
        self.task_filter.set('Todas');self.search.set('');self.reload();self.navigate('tasks')
        self.jobs.selection_set(str(job_id));self.jobs.see(str(job_id));self.details()
        self.notify('Sincronização pronta. Confira origem e destino abaixo e clique em Iniciar cópia.')

    def details(self):
        if not hasattr(self,'start_button'):return
        selection=self.jobs.selection()
        job=self.jobs_data.get(int(selection[0])) if selection else None
        if not job:
            self.detail.set('Selecione uma tarefa na lista para ver os números e os próximos passos.')
            self.task_progress.stop();self.task_progress.pack_forget()
            for button in (self.start_button,self.pause_button,self.cancel_button,self.recover_button):button.configure(state='disabled')
            self.pause_button.pack_forget();self.recover_button.pack_forget()
            return
        counts=self.job_counts.get(job['id'],{'sent':0,'skipped':0,'sending':0})
        next_step={'paused':'Pronta para continuar. Clique em Iniciar cópia.','running':'Acompanhe os envios. Você pode pausar a qualquer momento.','completed':'O histórico foi concluído. Nenhuma ação é necessária.','cancelled':'Esta tarefa foi cancelada. As publicações enviadas permanecem no destino.','attention':'Confira a mensagem abaixo. Se houver envio sem confirmação, abra o destino e use Conferir envio.'}[job['status']]
        mode='Histórico + novos posts' if job['mode']=='continuous' else 'Somente histórico'
        text=f"{job['source_title']} → {job['destination_title']}\n{LABELS[job['status']]} · {mode}\n\n{readable_count(counts['sent'])} publicadas  ·  {readable_count(counts['skipped'])} ignoradas  ·  {readable_count(counts['sending'])} sem confirmação\n\n{job['error'] or next_step}"
        self.detail.set(text)
        active=job['status']=='running'
        if active:
            self.task_progress.pack(fill='x',pady=(0,8));self.task_progress.start(30)
        else:self.task_progress.stop();self.task_progress.pack_forget()
        editable=job['status'] not in ('completed','cancelled') and not self.busy
        self.start_button.configure(state='normal' if editable and not active and not counts['sending'] else 'disabled')
        self.pause_button.configure(state='normal' if editable and active else 'disabled')
        self.cancel_button.configure(state='normal' if editable else 'disabled')
        review=job['status']=='attention' and bool(counts['sending'])
        self.recover_button.configure(state='normal' if editable and review else 'disabled')
        if active:self.pause_button.pack(side='left',padx=(0,8),pady=4)
        else:self.pause_button.pack_forget()
        if review:self.recover_button.pack(side='left',padx=(0,8),pady=4)
        else:self.recover_button.pack_forget()

    def reload(self):
        jobs=self.store.jobs();self.jobs_data={j['id']:j for j in jobs};self.job_counts=self.store.message_counts()
        empty={'sent':0,'skipped':0,'sending':0}
        totals={k:sum(c.get(k,0) for c in self.job_counts.values()) for k in empty}
        self.home_metrics['sent'].value.set(readable_count(totals['sent']))
        for status in ('running','paused','attention'):
            self.home_metrics[status].value.set(readable_count(sum(j['status']==status for j in jobs)))
        self.home_metrics['attention'].description.set(f"{readable_count(totals['sending'])} envios sem confirmação" if totals['sending'] else 'Tarefas que precisam de atenção')
        selected=self.jobs.selection();query=self.search.get().strip().casefold();state=FILTERS[self.task_filter.get()]
        visible=[j for j in jobs if (state is None or j['status']==state) and (not query or query in (j['source_title']+' '+j['destination_title']).casefold())]
        ids={str(j['id']) for j in visible}
        for iid in self.jobs.get_children():
            if iid not in ids:self.jobs.delete(iid)
        for job in visible:
            iid=str(job['id']);counts=self.job_counts.get(job['id'],empty)
            values=(job['source_title'],job['destination_title'],LABELS[job['status']],readable_count(counts['sent']),readable_count(counts['sending']))
            if self.jobs.exists(iid):self.jobs.item(iid,values=values,tags=(job['status'],))
            else:self.jobs.insert('','end',iid=iid,values=values,tags=(job['status'],))
        if selected and self.jobs.exists(selected[0]):self.jobs.selection_set(selected)
        self.tasks_empty.set('Nenhuma tarefa encontrada com este filtro.' if not visible and jobs else 'Você ainda não criou uma tarefa. Preencha os dois canais acima.' if not jobs else f'{len(visible)} tarefas nesta lista.')
        self.details()
        logs=[]
        for event in self.store.logs():
            local=datetime.fromisoformat(event['created_at']).astimezone().strftime('%d/%m %H:%M:%S')
            label=f"Tarefa {event['job_id']}" if event['job_id'] is not None else 'Aplicativo'
            logs.append(f"{local}  ·  {label}\n{event['event']}\n")
        self.activity.configure(state='normal');self.activity.delete('1.0','end');self.activity.insert('1.0','\n'.join(logs) or 'Nenhuma atividade registrada. Suas operações aparecerão aqui.');self.activity.configure(state='disabled')

    def close(self):
        if self.closing:return
        if (self.busy or any(j['status']=='running' for j in self.store.jobs())) and not messagebox.askyesno('Fechar aplicativo','As operações vão parar. Deseja fechar?',parent=self.root):return
        self.closing=True
        for timer in (self.poll_id,self.tick_id):self.root.after_cancel(timer)
        self.status.set('Encerrando conexão. Aguarde antes de desligar o computador…');self.runtime.close()
        def wait():
            if self.runtime.thread.is_alive():self.root.after(150,wait)
            else:self.store.close();self.root.destroy()
        self.root.after(150,wait)
