import json
import tkinter as tk
import webbrowser
from tkinter import ttk, messagebox
from .domain import UserError, replace
from .runtime import Runtime

LABELS = {'paused':'Pausada','running':'Em execução','completed':'Concluída','cancelled':'Cancelada','attention':'Conferir'}

class Window:
    def __init__(self, root, store):
        self.root,self.store = root,store
        self.runtime = Runtime(store)
        self.rules = json.loads(store.setting('rules') or '[]')
        self.busy = False
        self.closing = False
        self.login_dialog = None
        root.title('Telegram Sync — 00duHot | Gratuito e local')
        root.geometry('1120x800')
        root.minsize(900,680)
        root.configure(bg='#10141f')
        style = ttk.Style(root)
        style.theme_use('clam')
        style.configure('.',background='#171e2d',foreground='#ecf1ff',fieldbackground='#232d40',font=('Segoe UI',10))
        style.configure('TFrame',background='#10141f')
        style.configure('TLabel',background='#10141f')
        style.configure('Title.TLabel',font=('Segoe UI',24,'bold'),foreground='#77b7ff')
        style.configure('TButton',padding=(12,8),background='#2d4e78')
        style.map('TButton',background=[('active','#3c6494'),('disabled','#303848')])
        style.configure('TEntry',padding=7,insertcolor='white')
        style.configure('Treeview',background='#171e2d',fieldbackground='#171e2d',foreground='#ecf1ff',rowheight=30)
        style.map('Treeview',background=[('selected','#29527d')])
        style.configure('Treeview.Heading',background='#232d40',padding=6)
        body=ttk.Frame(root,padding=24); body.pack(fill='both',expand=True)
        ttk.Label(body,text='Telegram Sync',style='Title.TLabel').pack(anchor='w')
        ttk.Label(body,text='Clone e sincronize canais e grupos autorizados. Sem servidor e sem mensalidade.',wraplength=1000).pack(anchor='w',pady=(4,14))
        top=ttk.Frame(body);top.pack(fill='x')
        self.account=tk.StringVar(value='Conta salva neste Windows' if store.setting('account') else 'Nenhuma conta conectada')
        ttk.Label(top,textvariable=self.account).pack(side='left')
        self.connect_button=ttk.Button(top,text='Conectar Telegram',command=self.login);self.connect_button.pack(side='right')
        ttk.Button(top,text='Desconectar',command=self.disconnect).pack(side='right',padx=8)
        ttk.Label(body,text='O computador deve permanecer ligado, conectado à internet e com este aplicativo aberto.',foreground='#a9bbd1').pack(anchor='w',pady=12)
        tabs=ttk.Notebook(body);tabs.pack(fill='both',expand=True)
        tasks=ttk.Frame(tabs,padding=16);rules=ttk.Frame(tabs,padding=16);logs=ttk.Frame(tabs,padding=16)
        tabs.add(tasks,text='  Sincronizações  ');tabs.add(rules,text='  Substituir links e textos  ');tabs.add(logs,text='  Atividade e ajuda  ')
        from .editor_ui import EditorTab
        self.editor_tab=EditorTab(self,tabs)
        form=ttk.Frame(tasks);form.pack(fill='x')
        form.columnconfigure(1,weight=1)
        self.source=tk.StringVar();self.destination=tk.StringVar();self.mode=tk.StringVar(value='history');self.authorized=tk.BooleanVar()
        for index,(label,var) in enumerate((('Origem',self.source),('Destino',self.destination))):
            ttk.Label(form,text=label).grid(row=index,column=0,sticky='w',padx=(0,12),pady=5)
            ttk.Entry(form,textvariable=var).grid(row=index,column=1,sticky='ew',pady=5)
        ttk.Label(form,text='Aceita ID numérico, @username ou link público t.me. Para privados, entre no canal primeiro.').grid(row=2,column=1,sticky='w',pady=4)
        options=ttk.Frame(tasks);options.pack(fill='x',pady=8)
        ttk.Radiobutton(options,text='Importar histórico',variable=self.mode,value='history').pack(side='left')
        ttk.Radiobutton(options,text='Histórico + novos posts',variable=self.mode,value='continuous').pack(side='left',padx=16)
        ttk.Checkbutton(tasks,text='Tenho autorização para republicar o conteúdo da origem.',variable=self.authorized).pack(anchor='w',pady=8)
        buttons=ttk.Frame(tasks);buttons.pack(fill='x',pady=6)
        self.resolve_button=ttk.Button(buttons,text='Verificar canais',command=self.resolve);self.resolve_button.pack(side='left')
        self.create_button=ttk.Button(buttons,text='Criar tarefa pausada',command=self.create);self.create_button.pack(side='left',padx=8)
        self.resolved=tk.StringVar()
        ttk.Label(tasks,textvariable=self.resolved,wraplength=950).pack(anchor='w',pady=4)
        self.jobs=ttk.Treeview(tasks,columns=('source','destination','status','processed'),show='headings',height=6,selectmode='browse')
        for column,title,width in [('source','Origem',230),('destination','Destino',230),('status','Estado',125),('processed','Mensagens',95)]:
            self.jobs.heading(column,text=title);self.jobs.column(column,width=width,minwidth=70)
        self.jobs.pack(fill='both',expand=True,pady=8)
        self.jobs.bind('<<TreeviewSelect>>',lambda _: self.details())
        controls=ttk.Frame(tasks);controls.pack(fill='x')
        for label,action in [('Iniciar / retomar','start'),('Pausar','pause'),('Cancelar','cancel')]:
            ttk.Button(controls,text=label,command=lambda action=action:self.control(action)).pack(side='left',padx=(0,8))
        ttk.Button(controls,text='Conferir envio pendente',command=self.recover).pack(side='left')
        self.detail=tk.StringVar(value='Selecione uma tarefa para ver detalhes.');ttk.Label(tasks,textvariable=self.detail,wraplength=950).pack(anchor='w',pady=8)
        ttk.Label(rules,text='As regras desta aba são copiadas para cada nova tarefa. Tarefas existentes mantêm suas regras.',wraplength=950).pack(anchor='w',pady=(0,12))
        ruleform=ttk.Frame(rules);ruleform.pack(fill='x');ruleform.columnconfigure((0,1),weight=1)
        self.find=tk.StringVar();self.replacement=tk.StringVar()
        ttk.Label(ruleform,text='Texto ou link original').grid(row=0,column=0,sticky='w')
        ttk.Label(ruleform,text='Substituir por (vazio remove)').grid(row=0,column=1,sticky='w',padx=8)
        ttk.Entry(ruleform,textvariable=self.find).grid(row=1,column=0,sticky='ew',pady=6)
        ttk.Entry(ruleform,textvariable=self.replacement).grid(row=1,column=1,sticky='ew',padx=8,pady=6)
        ttk.Button(ruleform,text='Adicionar',command=self.add_rule).grid(row=1,column=2)
        self.rules_tree=ttk.Treeview(rules,columns=('find','replacement'),show='headings',height=5,selectmode='browse')
        for column,title in [('find','Original'),('replacement','Substituto')]: self.rules_tree.heading(column,text=title); self.rules_tree.column(column,width=400)
        self.rules_tree.pack(fill='x',pady=8)
        ttk.Button(rules,text='Remover regra selecionada',command=self.remove_rule).pack(anchor='w')
        ttk.Label(rules,text='Teste uma legenda antes de criar a tarefa:').pack(anchor='w',pady=(16,6))
        self.sample=tk.Text(rules,height=4,bg='#171e2d',fg='white',insertbackground='white',wrap='word');self.sample.pack(fill='x')
        ttk.Button(rules,text='Pré-visualizar substituições',command=self.preview).pack(anchor='w',pady=8)
        self.preview_text=tk.Text(rules,height=4,bg='#171e2d',fg='#8dd5b3',wrap='word',state='disabled');self.preview_text.pack(fill='both',expand=True)
        helptext='Dados e credenciais ficam neste computador. A sessão é protegida pelo usuário do Windows.\nNão copia membros, reações, tópicos, respostas ou edições/exclusões posteriores. A formatação vira texto simples; links ocultos são preservados como URLs.\nAo fechar, as tarefas param. Na próxima abertura, ficam pausadas até você iniciar. Não há envio automático ao abrir.\nPara revogar o acesso, use Desconectar ou Telegram > Configurações > Dispositivos.\nSe um envio ficar sem confirmação, confira o destino antes de autorizar uma nova tentativa.'
        ttk.Label(logs,text=helptext,wraplength=950,justify='left').pack(anchor='w',pady=(0,12))
        self.activity=tk.Text(logs,bg='#171e2d',fg='#c9d9ee',wrap='word',state='disabled');self.activity.pack(fill='both',expand=True)
        ttk.Label(logs,text='Dados locais: '+str(store.path if hasattr(store,'path') else 'pasta de dados do usuário'),wraplength=950).pack(anchor='w',pady=8)
        self.status=tk.StringVar(value='Pronto. Conecte uma conta e configure uma tarefa.')
        ttk.Label(body,textvariable=self.status,wraplength=1000).pack(anchor='w',pady=(12,0))
        self.reload_rules()
        self.reload()
        root.after(150,self.poll)
        root.protocol('WM_DELETE_WINDOW',self.close)

    def notify(self,text,error=False):
        self.status.set(text)
        if error: messagebox.showerror('Telegram Sync',text,parent=self.root)

    def dispatch(self,coro,callback=None):
        if self.busy:
            coro.close()
            self.notify('Aguarde a operação atual.');return
        self.busy=True
        self.status.set('Conectando ao Telegram…')
        self.runtime.submit(coro,callback)

    def poll(self):
        while not self.runtime.events.empty():
            kind,value,callback=self.runtime.events.get_nowait()
            if kind in ('result','error'):
                self.busy=False
            if kind=='error':
                self.notify(value,error=True)
                self.editor_tab.refresh()
                if self.login_dialog and self.login_dialog.winfo_exists():
                    self.login_submit.configure(state='normal')
            elif kind=='result':
                self.status.set('Operação concluída.')
                if callback: callback(value)
                self.reload()
                self.editor_tab.refresh()
            elif kind=='editor_progress':
                self.status.set(value)
            elif kind=='account': self.account.set(value)
            elif kind=='refresh': self.reload()
        if not self.closing: self.root.after(150,self.poll)

    def login(self):
        if self.store.setting('account'):
            self.notify('Já existe uma conta salva. Desconecte antes de trocar.',True);return
        if self.login_dialog and self.login_dialog.winfo_exists(): self.login_dialog.lift();return
        dialog=tk.Toplevel(self.root);self.login_dialog=dialog;dialog.title('Conectar Telegram');dialog.geometry('580x480');dialog.transient(self.root)
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
        def done(job_id): self.notify(f'Tarefa {job_id} criada pausada. Selecione e clique em Iniciar.')
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

    def details(self):
        try:
            job=self.store.job(self.selected())
            self.detail.set(f"Tarefa {job['id']} | Checkpoint {job['checkpoint']} | {len(json.loads(job['rules']))} regras. "+(job['error'] or ''))
        except UserError:pass

    def reload(self):
        selection=self.jobs.selection()
        jobs=self.store.jobs()
        current={str(job['id']) for job in jobs}
        for iid in self.jobs.get_children():
            if iid not in current:self.jobs.delete(iid)
        for job in jobs:
            iid=str(job['id']);values=(job['source_title'],job['destination_title'],LABELS[job['status']],job['processed'])
            if self.jobs.exists(iid):self.jobs.item(iid,values=values)
            else:self.jobs.insert('','end',iid=iid,values=values)
        if selection and self.jobs.exists(selection[0]):self.jobs.selection_set(selection)
        self.details()
        self.activity.configure(state='normal');self.activity.delete('1.0','end')
        for log in self.store.logs():self.activity.insert('end',f"{log['created_at'][:19].replace('T',' ')} UTC | Tarefa {log['job_id']} | {log['event']}\n")
        self.activity.configure(state='disabled')

    def close(self):
        if self.closing:return
        if (self.busy or any(j['status']=='running' for j in self.store.jobs())) and not messagebox.askyesno('Fechar aplicativo','As operações vão parar. Deseja fechar?',parent=self.root):return
        self.closing=True
        self.status.set('Encerrando conexão. Não desligue o computador ainda…')
        self.runtime.close()
        def wait():
            if self.runtime.thread.is_alive():self.root.after(150,wait)
            else:
                self.store.close();self.root.destroy()
        self.root.after(150,wait)
