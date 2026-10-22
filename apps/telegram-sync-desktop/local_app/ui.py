import json
import tkinter as tk
import webbrowser
from datetime import datetime
from tkinter import ttk, messagebox
from .domain import UserError, replace
from .runtime import Runtime
from .design import BG, SIDEBAR, CARD, BORDER, TEXT, MUTED, BLUE, GREEN, AMBER, RED
from .design import theme, ScrollPage, heading, card, metrics, text_box, table, readable_count

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
        self.resolved=tk.StringVar();self.status=tk.StringVar(value='Pronto. Escolha o que você quer fazer no menu ao lado.')
        self.account=tk.StringVar(value='Sessão salva neste Windows' if store.setting('account') else 'Nenhuma conta conectada')
        root.title('Telegram Sync · 00duHot')
        width=max(980,min(1320,root.winfo_screenwidth()-80));height=max(640,min(900,root.winfo_screenheight()-140))
        root.geometry(f'{width}x{height}+16+8');root.minsize(980,640)
        theme(root)
        self.shell=tk.Frame(root,bg=BG);self.shell.pack(fill='both',expand=True)
        sidebar=tk.Frame(self.shell,bg=SIDEBAR,width=216,padx=14,pady=14);sidebar.pack(side='left',fill='y');sidebar.pack_propagate(False)
        logo=tk.Frame(sidebar,bg=SIDEBAR);logo.pack(fill='x',pady=(0,20))
        mark=tk.Canvas(logo,width=38,height=40,bg=SIDEBAR,highlightthickness=0);mark.pack(side='left',padx=(0,10))
        mark.create_rectangle(1,1,37,37,fill='#2874de',outline='')
        mark.create_polygon(22,7,12,21,19,21,16,32,28,16,21,16,fill='white')
        logotext=tk.Frame(logo,bg=SIDEBAR);logotext.pack(side='left')
        tk.Label(logotext,text='00duHot',font=('Segoe UI',17,'bold'),fg=TEXT,bg=SIDEBAR).pack(anchor='w')
        tk.Label(logotext,text='OPERAÇÃO DIGITAL',font=('Segoe UI',8),fg=MUTED,bg=SIDEBAR).pack(anchor='w')
        tk.Label(sidebar,text='TELEGRAM SYNC',bg=SIDEBAR,fg=BLUE,font=('Segoe UI',9,'bold')).pack(anchor='w',padx=10,pady=(0,12))
        self.nav={}
        for key,title,caption in [('home','Visão geral','Números e próximos passos'),('tasks','Sincronizações','Copiar e acompanhar posts'),('editor','Editar links','Alterar posts do seu canal'),('rules','Substituições','Regras para novas cópias'),('activity','Atividade e ajuda','Histórico e orientações')]:
            button=tk.Button(sidebar,text=f'{title}\n{caption}',anchor='w',justify='left',bg=SIDEBAR,fg=MUTED,activebackground=CARD,activeforeground=TEXT,font=('Segoe UI',10),relief='flat',borderwidth=0,padx=13,pady=8,cursor='hand2',command=lambda key=key:self.navigate(key),takefocus=True,highlightthickness=1,highlightbackground=SIDEBAR,highlightcolor=BLUE)
            button.pack(fill='x',pady=3);self.nav[key]=button
        tk.Label(sidebar,text='v0.3.0  ·  Gratuito e local',bg=SIDEBAR,fg=MUTED,font=('Segoe UI',9)).pack(side='bottom',anchor='w',padx=8,pady=(10,0))
        accountbox=tk.Frame(sidebar,bg=CARD,padx=12,pady=10,highlightbackground=BORDER,highlightthickness=1);accountbox.pack(side='bottom',fill='x')
        tk.Label(accountbox,text='SUA CONTA',bg=CARD,fg=MUTED,font=('Segoe UI',8,'bold')).pack(anchor='w')
        tk.Label(accountbox,textvariable=self.account,bg=CARD,fg=TEXT,font=('Segoe UI',10),wraplength=155,justify='left').pack(anchor='w',pady=(6,10))
        self.connect_button=ttk.Button(accountbox,text='Conectar Telegram',style='Primary.TButton',command=self.login);self.connect_button.pack(fill='x')
        self.disconnect_button=ttk.Button(accountbox,text='Desconectar conta',style='Quiet.TButton',command=self.disconnect);self.disconnect_button.pack(fill='x',pady=(6,0))
        main=ttk.Frame(self.shell);main.pack(side='left',fill='both',expand=True)
        top=tk.Frame(main,bg=BG,padx=26,pady=16,highlightthickness=0);top.pack(fill='x')
        self.breadcrumb=tk.StringVar(value='Telegram Sync  /  Visão geral')
        tk.Label(top,textvariable=self.breadcrumb,bg=BG,fg=MUTED,font=('Segoe UI',10)).pack(side='left')
        tk.Label(top,text='●  NO SEU COMPUTADOR',bg=BG,fg=GREEN,font=('Segoe UI',8,'bold')).pack(side='right')
        ttk.Separator(main).pack(fill='x')
        footer=ttk.Frame(main,padding=(24,12));footer.pack(side='bottom',fill='x')
        self.spinner=ttk.Progressbar(footer,mode='indeterminate',length=70)
        self.spinner.pack(side='right',padx=(16,0))
        self.status_label=ttk.Label(footer,textvariable=self.status,style='Muted.TLabel',wraplength=700);self.status_label.pack(side='left',fill='x',expand=True)
        footer.bind('<Configure>',lambda e:self.status_label.configure(wraplength=max(200,e.width-160)))
        self.tabs=ttk.Notebook(main,style='Page.TNotebook');self.tabs.pack(fill='both',expand=True)
        self.pages={}
        for key in ('home','tasks','rules','activity'):
            page=ScrollPage(self.tabs);self.tabs.add(page,text=key);self.pages[key]=page
        self.build_home(self.pages['home'].inner)
        self.build_tasks(self.pages['tasks'].inner)
        self.build_rules(self.pages['rules'].inner)
        self.build_activity(self.pages['activity'].inner)
        from .editor_ui import EditorTab
        self.editor_tab=EditorTab(self,self.tabs);self.pages['editor']=self.editor_tab.frame
        self.tabs.bind('<<NotebookTabChanged>>',self.page_changed)
        self.reload_rules();self.reload();self.navigate('home');self.update_buttons()
        root.after(150,self.poll);root.after(1000,self.tick)
        root.protocol('WM_DELETE_WINDOW',self.close)

    def button(self,parent,text,command,primary=False,side='left'):
        button=ttk.Button(parent,text=text,command=command,style='Primary.TButton' if primary else 'TButton')
        button.pack(side=side,padx=(0,8),pady=4)
        self.operation_buttons.append(button)
        return button

    def navigate(self,key):
        self.tabs.select(self.pages[key]);self.active_page=key;self.page_changed()

    def page_changed(self,_event=None):
        selected=self.tabs.select()
        for key,page in self.pages.items():
            active=str(page)==selected
            self.nav[key].configure(bg='#17263d' if active else SIDEBAR,fg=TEXT if active else MUTED,highlightbackground='#284970' if active else SIDEBAR)
            if active:
                self.active_page=key
                self.breadcrumb.set('Telegram Sync  /  '+self.nav[key].cget('text').split('\n')[0])

    def build_home(self,parent):
        heading(parent,'Seu painel de controle','Tudo sob controle.','Acompanhe suas sincronizações e edite links sem perder de vista o que está acontecendo.')
        self.home_metrics=metrics(parent,[('sent','Publicadas','Mensagens confirmadas',GREEN),('running','Em execução','Sincronizações ativas',BLUE),('paused','Pausadas','Tarefas aguardando você',AMBER),('attention','A conferir','Tarefas que precisam de atenção',RED)])
        nextbox=card(parent,'Seu próximo passo')
        self.next_step=tk.StringVar()
        ttk.Label(nextbox,textvariable=self.next_step,style='CardMuted.TLabel',wraplength=700).pack(anchor='w',pady=(0,10))
        actions=ttk.Frame(nextbox,style='Card.TFrame');actions.pack(fill='x')
        self.next_button=self.button(actions,'Conectar minha conta',self.next_action,True)
        self.button(actions,'Ver minhas tarefas',lambda:self.navigate('tasks'))
        shortcuts=card(parent,'O que você quer fazer?','Escolha uma ferramenta. Você confere os dados antes de iniciar qualquer alteração.')
        row=ttk.Frame(shortcuts,style='Card.TFrame');row.pack(fill='x')
        for index,(title,description,label,action) in enumerate([
            ('Copiar para outro canal','Importe o histórico e acompanhe novas publicações.','Nova sincronização',self.new_task),
            ('Trocar links existentes','Edite links de posts que já estão no seu canal.','Abrir editor de links',lambda:self.navigate('editor'))]):
            row.columnconfigure(index,weight=1,uniform='shortcut')
            block=ttk.Frame(row,style='Card.TFrame',padding=(0 if index==0 else 18,8,18,0));block.grid(row=0,column=index,sticky='nsew')
            ttk.Label(block,text=title,style='CardHeading.TLabel').pack(anchor='w')
            labelwidget=ttk.Label(block,text=description,style='CardMuted.TLabel',wraplength=320);labelwidget.pack(anchor='w',pady=(6,10))
            block.bind('<Configure>',lambda e,w=labelwidget:w.configure(wraplength=max(180,e.width-40)))
            ttk.Button(block,text=label,command=action,style='Quiet.TButton').pack(anchor='w')
        recent=card(parent,'Sincronizações recentes','Os números abaixo são de cópias entre canais. Edições de links aparecem dentro do editor.')
        self.recent=table(recent,[('route','Origem → destino',350),('status','Situação',160),('sent','Publicadas',90)],height=4)
        self.recent.bind('<Double-1>',lambda _event:self.open_recent())
        self.home_empty=tk.StringVar();ttk.Label(recent,textvariable=self.home_empty,style='CardMuted.TLabel').pack(anchor='w')
        ttk.Label(parent,text='Mantenha o computador ligado, com internet e o aplicativo aberto para continuar as operações.',style='Muted.TLabel',wraplength=740).pack(anchor='w',pady=(0,10))

    def next_action(self):
        if not self.store.setting('account'):self.login()
        elif any(j['status']=='attention' for j in self.jobs_data.values()):self.navigate('tasks');self.task_filter.set('Precisam de atenção')
        elif self.jobs_data:self.navigate('tasks')
        else:self.new_task()

    def open_recent(self):
        selected=self.recent.selection()
        if not selected:return
        self.task_filter.set('Todas');self.search.set('');self.navigate('tasks');self.reload()
        if self.jobs.exists(selected[0]):self.jobs.selection_set(selected);self.jobs.see(selected[0]);self.details()

    def build_tasks(self,parent):
        heading(parent,'Copiar e sincronizar','Suas sincronizações','Veja o que foi publicado, o que está pausado e o que precisa da sua atenção.')
        actionrow=ttk.Frame(parent);actionrow.pack(fill='x',pady=(0,14))
        self.button(actionrow,'+ Nova sincronização',self.new_task,True)
        filters=card(parent,'Acompanhar tarefas')
        toolbar=ttk.Frame(filters,style='Card.TFrame');toolbar.pack(fill='x',pady=(0,10));toolbar.columnconfigure(1,weight=1)
        self.task_filter=tk.StringVar(value='Todas');self.search=tk.StringVar()
        ttk.Combobox(toolbar,textvariable=self.task_filter,values=list(FILTERS),state='readonly',width=23).grid(row=0,column=0,sticky='w',padx=(0,12))
        ttk.Entry(toolbar,textvariable=self.search).grid(row=0,column=1,sticky='ew')
        ttk.Label(filters,text='Busque pelo nome do canal de origem ou destino no campo acima.',style='CardMuted.TLabel').pack(anchor='w')
        controls=ttk.Frame(filters,style='Card.TFrame');controls.pack(fill='x')
        self.start_button=self.button(controls,'Iniciar / retomar',lambda:self.control('start'),True)
        self.pause_button=self.button(controls,'Pausar',lambda:self.control('pause'))
        self.cancel_button=self.button(controls,'Cancelar tarefa',lambda:self.control('cancel'))
        self.recover_button=self.button(controls,'Conferir envio',self.recover)
        self.jobs=table(filters,[('source','Origem',190),('destination','Destino',190),('status','Situação',170),('sent','Publicadas',90),('pending','A conferir',85)],height=4)
        self.jobs.bind('<<TreeviewSelect>>',lambda _event:self.details())
        self.tasks_empty=tk.StringVar();ttk.Label(filters,textvariable=self.tasks_empty,style='CardMuted.TLabel',wraplength=700).pack(anchor='w')
        self.task_filter.trace_add('write',lambda *_:self.reload());self.search.trace_add('write',lambda *_:self.reload())
        detailbox=card(parent,'Detalhes da tarefa selecionada')
        self.detail=tk.StringVar(value='Selecione uma tarefa na lista acima.')
        ttk.Label(detailbox,textvariable=self.detail,style='CardMuted.TLabel',wraplength=700,justify='left').pack(anchor='w',pady=(0,8))
        self.task_progress=ttk.Progressbar(detailbox,mode='indeterminate');self.task_progress.pack(fill='x',pady=(0,8))
        ttk.Label(detailbox,text='A conferir: o envio ficou sem confirmação. Abra o canal de destino antes de decidir se deve reenviar.',style='CardMuted.TLabel',wraplength=700).pack(anchor='w',pady=(10,0))

    def new_task(self):
        if self.busy:self.notify('Aguarde a operação atual.');return
        if self.task_dialog and self.task_dialog.winfo_exists():self.task_dialog.lift();return
        self.navigate('tasks')
        dialog=tk.Toplevel(self.root);self.task_dialog=dialog;dialog.title('Nova sincronização · Telegram Sync');dialog.geometry('760x690');dialog.minsize(660,540);dialog.transient(self.root);dialog.configure(bg=BG)
        page=ScrollPage(dialog,padding=22);page.pack(fill='both',expand=True);box=page.inner
        heading(box,'Uma nova tarefa','Copiar para outro canal','Configure, confira os canais e crie a tarefa. Você decide quando iniciar.')
        form=card(box,'1. De onde para onde?','Aceita @username, link público t.me ou ID numérico. Para canais privados, participe do canal primeiro.')
        for label,var in [('Canal de origem · de onde copiar',self.source),('Canal de destino · onde publicar',self.destination)]:
            ttk.Label(form,text=label,style='Card.TLabel').pack(anchor='w',pady=(6,4));ttk.Entry(form,textvariable=var).pack(fill='x')
        options=card(box,'2. O que deseja copiar?')
        ttk.Radiobutton(options,text='Só o histórico · copiar as publicações existentes',variable=self.mode,value='history').pack(anchor='w')
        ttk.Radiobutton(options,text='Histórico + novos posts · continuar acompanhando o canal',variable=self.mode,value='continuous').pack(anchor='w')
        ttk.Label(options,text=f'{len(self.rules)} regras de substituição serão copiadas para esta tarefa.',style='CardMuted.TLabel').pack(anchor='w',pady=(8,0))
        confirm=card(box,'3. Confira antes de criar')
        ttk.Checkbutton(confirm,text='Tenho autorização para republicar o conteúdo da origem.',variable=self.authorized).pack(anchor='w')
        self.resolved.set('Confira os canais para ver seus nomes e identificadores aqui.')
        ttk.Label(confirm,textvariable=self.resolved,style='CardMuted.TLabel',wraplength=620).pack(anchor='w',pady=(8,6))
        buttons=ttk.Frame(confirm,style='Card.TFrame');buttons.pack(fill='x')
        self.resolve_button=self.button(buttons,'Verificar canais',self.resolve)
        self.create_button=self.button(buttons,'Criar tarefa pausada',self.create,True)
        dialog.protocol('WM_DELETE_WINDOW',dialog.destroy)
        self.update_buttons()

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
        self.details()
        if hasattr(self,'editor_tab'):self.editor_tab.update_buttons()

    def dispatch(self,coro,callback=None):
        if self.busy:coro.close();self.notify('Aguarde a operação atual.');return
        self.busy=True;self.spinner.start(12);self.status.set('Operação em andamento. Acompanhe o progresso nesta janela…');self.update_buttons()
        self.runtime.submit(coro,callback)

    def poll(self):
        while not self.runtime.events.empty():
            kind,value,callback=self.runtime.events.get_nowait()
            if kind in ('result','error'):
                self.busy=False;self.spinner.stop()
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
        if not self.closing:self.root.after(150,self.poll)

    def tick(self):
        if self.closing:return
        if self.editor_tab.batch_id is not None:self.editor_tab.refresh_progress()
        self.root.after(1000,self.tick)

    def login(self):
        if self.store.setting('account'):
            self.notify('Já existe uma conta salva. Desconecte antes de trocar.',True);return
        if self.login_dialog and self.login_dialog.winfo_exists(): self.login_dialog.lift();return
        dialog=tk.Toplevel(self.root);self.login_dialog=dialog;dialog.title('Conectar Telegram');dialog.geometry('670x610');dialog.configure(bg=BG);dialog.transient(self.root)
        box=ttk.Frame(dialog,padding=22);box.pack(fill='both',expand=True)
        ttk.Label(box,text='Conecte diretamente ao Telegram',font=('Segoe UI',15,'bold')).pack(anchor='w')
        ttk.Label(box,text='Obtenha seu API ID e API Hash em my.telegram.org > API development tools. Código e senha são enviados somente ao Telegram.',wraplength=530).pack(anchor='w',pady=10)
        ttk.Button(box,text='Abrir my.telegram.org',command=lambda:webbrowser.open('https://my.telegram.org')).pack(anchor='w',pady=(0,8))
        self.login_vars={name:tk.StringVar() for name in ('api_id','api_hash','phone','code','password')}
        self.login_entries={}
        for name,label in [('api_id','API ID'),('api_hash','API Hash'),('phone','Telefone com +55'),('code','Código recebido no Telegram'),('password','Senha de duas etapas (se solicitada)')]:
            row=ttk.Frame(box);row.pack(fill='x',pady=3)
            ttk.Label(row,text=label,width=28).pack(side='left')
            entry=ttk.Entry(row,textvariable=self.login_vars[name],show='•' if name in ('api_hash','code','password') else '')
            entry.pack(side='left',fill='x',expand=True);self.login_entries[name]=entry
            if name in ('code','password'): entry.configure(state='disabled')
        self.login_stage='start'
        self.login_submit=ttk.Button(box,text='Solicitar código',command=self.login_step);self.login_submit.pack(anchor='w',pady=14)
        self.login_hint=tk.StringVar(value='Os campos secretos não são gravados em logs.')
        ttk.Label(box,textvariable=self.login_hint,wraplength=530).pack(anchor='w')
        def cancel():
            for value in self.login_vars.values(): value.set('')
            self.runtime.submit(self.runtime.engine.abort_login())
            dialog.destroy();self.login_dialog=None
        dialog.protocol('WM_DELETE_WINDOW',cancel)

    def login_step(self):
        if self.busy: return
        self.login_submit.configure(state='disabled')
        values={key:value.get() for key,value in self.login_vars.items()}
        def complete(stage):
            if not self.login_dialog or not self.login_dialog.winfo_exists(): return
            self.login_submit.configure(state='normal')
            if stage=='connected':
                for value in self.login_vars.values(): value.set('')
                self.login_dialog.destroy();self.login_dialog=None
                self.notify('Conta conectada e protegida neste Windows.');return
            self.login_stage=stage
            for name in ('api_id','api_hash','phone'): self.login_entries[name].configure(state='disabled')
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
        if self.task_dialog and self.task_dialog.winfo_exists():self.task_dialog.destroy()
        self.task_filter.set('Todas');self.search.set('');self.reload();self.navigate('tasks')
        self.jobs.selection_set(str(job_id));self.jobs.see(str(job_id));self.details()
        self.notify('Tarefa criada e pausada. Confira os detalhes e clique em Iniciar quando estiver pronto.')

    def details(self):
        if not hasattr(self,'start_button'):return
        selection=self.jobs.selection()
        job=self.jobs_data.get(int(selection[0])) if selection else None
        if not job:
            self.detail.set('Selecione uma tarefa na lista para ver os números e os próximos passos.')
            self.task_progress.stop()
            for button in (self.start_button,self.pause_button,self.cancel_button,self.recover_button):button.configure(state='disabled')
            return
        counts=self.job_counts.get(job['id'],{'sent':0,'skipped':0,'sending':0})
        next_step={'paused':'Pronta para continuar. Clique em Iniciar / retomar.','running':'Acompanhe os envios. Você pode pausar a qualquer momento.','completed':'O histórico foi concluído. Nenhuma ação é necessária.','cancelled':'Esta tarefa foi cancelada. As publicações enviadas permanecem no destino.','attention':'Confira a mensagem abaixo. Se houver envio sem confirmação, abra o destino e use Conferir envio.'}[job['status']]
        mode='Histórico + novos posts' if job['mode']=='continuous' else 'Somente histórico'
        text=f"{job['source_title']} → {job['destination_title']}\n{LABELS[job['status']]} · {mode}\n\n{readable_count(counts['sent'])} publicadas  ·  {readable_count(counts['skipped'])} ignoradas  ·  {readable_count(counts['sending'])} sem confirmação\n\n{job['error'] or next_step}"
        self.detail.set(text)
        active=job['status']=='running'
        if active and not self.task_progress.instate(['disabled']):self.task_progress.start(30)
        else:self.task_progress.stop()
        editable=job['status'] not in ('completed','cancelled') and not self.busy
        self.start_button.configure(state='normal' if editable and not active and not counts['sending'] else 'disabled')
        self.pause_button.configure(state='normal' if editable and active else 'disabled')
        self.cancel_button.configure(state='normal' if editable else 'disabled')
        self.recover_button.configure(state='normal' if editable and job['status']=='attention' and counts['sending'] else 'disabled')

    def reload(self):
        jobs=self.store.jobs();self.jobs_data={j['id']:j for j in jobs};self.job_counts=self.store.message_counts()
        empty={'sent':0,'skipped':0,'sending':0}
        totals={k:sum(c.get(k,0) for c in self.job_counts.values()) for k in empty}
        self.home_metrics['sent'].value.set(readable_count(totals['sent']))
        for status in ('running','paused','attention'):
            self.home_metrics[status].value.set(readable_count(sum(j['status']==status for j in jobs)))
        self.home_metrics['attention'].description.set(f"{readable_count(totals['sending'])} envios sem confirmação" if totals['sending'] else 'Tarefas que precisam de atenção')
        saved=bool(self.store.setting('account'))
        if not saved:
            self.next_step.set('Comece conectando sua conta do Telegram. Depois escolha entre sincronizar canais ou editar links.');self.next_button.configure(text='Conectar minha conta')
        elif any(j['status']=='attention' for j in jobs):
            self.next_step.set('Há tarefas que precisam de atenção. Confira os detalhes antes de retomar os envios.');self.next_button.configure(text='Conferir tarefas')
        elif jobs:
            self.next_step.set('Sua sessão está salva. Acompanhe as tarefas, retome uma sincronização pausada ou abra o editor de links.');self.next_button.configure(text='Acompanhar tarefas')
        else:
            self.next_step.set('Sua sessão está salva. Crie sua primeira sincronização ou use o editor para trocar links do seu canal.');self.next_button.configure(text='Criar primeira tarefa')
        self.recent.delete(*self.recent.get_children())
        for job in jobs[:5]:self.recent.insert('','end',iid=str(job['id']),values=(job['source_title']+' → '+job['destination_title'],LABELS[job['status']],readable_count(self.job_counts.get(job['id'],empty)['sent'])),tags=(job['status'],))
        self.home_empty.set('Nenhuma sincronização criada. Use Nova sincronização para começar.' if not jobs else 'Dê dois cliques em uma tarefa para ver os detalhes.')
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
        self.tasks_empty.set('Nenhuma tarefa encontrada com este filtro.' if not visible and jobs else 'Você ainda não criou uma tarefa. Clique em + Nova sincronização.' if not jobs else f'{len(visible)} tarefas nesta lista.')
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
        self.closing=True;self.status.set('Encerrando conexão. Aguarde antes de desligar o computador…');self.runtime.close()
        def wait():
            if self.runtime.thread.is_alive():self.root.after(150,wait)
            else:self.store.close();self.root.destroy()
        self.root.after(150,wait)
