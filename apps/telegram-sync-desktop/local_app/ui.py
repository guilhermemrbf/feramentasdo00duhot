import tkinter as tk
import webbrowser
from datetime import datetime
from tkinter import ttk, messagebox
from .runtime import Runtime
from .branding import brand_image
from .design import BLUE, GREEN, AMBER, RED
from .design import theme, ScrollPage, heading, card, metrics, text_box, Fold


class Window:
    def __init__(self,root,store):
        self.root,self.store=root,store
        self.runtime=Runtime(store)
        self.busy=False;self.closing=False;self.login_dialog=None
        self.operation_buttons=[];self.active_page='editor'
        self.status=tk.StringVar(value='Conecte sua conta e analise os links do canal que você administra.')
        self.account=tk.StringVar(value='Conta salva neste Windows' if store.setting('account') else 'Telegram não conectado')
        root.title('Trocar links do meu canal · Telegram Sync · 00duHot')
        width=max(980,min(1280,root.winfo_screenwidth()-80));height=max(640,min(900,root.winfo_screenheight()-140))
        root.geometry(f'{width}x{height}+16+8');root.minsize(980,640);theme(root)
        self.shell=ttk.Frame(root);self.shell.pack(fill='both',expand=True)
        top=ttk.Frame(self.shell,padding=(22,12));top.pack(fill='x')
        self.brand_mark=brand_image(40);root.iconphoto(True,self.brand_mark)
        ttk.Label(top,image=self.brand_mark).pack(side='left',padx=(0,10))
        ttk.Label(top,text='Trocar links do meu canal',style='Heading.TLabel').pack(side='left')
        ttk.Label(top,text='00duHot · v0.7.1',style='Muted.TLabel').pack(side='left',padx=14)
        self.account_controls=ttk.Frame(top);self.account_controls.pack(side='right')
        ttk.Label(self.account_controls,textvariable=self.account,style='Muted.TLabel').pack(side='left',padx=12)
        self.connect_button=ttk.Button(self.account_controls,text='Conectar Telegram',style='Primary.TButton',command=self.login)
        self.disconnect_button=ttk.Button(self.account_controls,text='Desconectar',style='Quiet.TButton',command=self.disconnect)
        self.edit_dashboard=ttk.Frame(self.shell,padding=(22,0,22,0));self.edit_dashboard.pack(fill='x')
        self.edit_metrics=metrics(self.edit_dashboard,[('pending','Posts pendentes','Aguardam alteração',AMBER),('applied','Posts alterados','Confirmados no Telegram',GREEN),('restored','Restaurados','Backup aplicado',BLUE),('conflict','Ignorados','Confira o motivo no post',RED)],compact=True)
        footer=ttk.Frame(self.shell,padding=(22,10));footer.pack(side='bottom',fill='x')
        self.spinner=ttk.Progressbar(footer,mode='indeterminate',length=70)
        self.status_label=ttk.Label(footer,textvariable=self.status,style='Muted.TLabel',wraplength=900);self.status_label.pack(side='left',fill='x',expand=True)
        footer.bind('<Configure>',lambda e:self.status_label.configure(wraplength=max(200,e.width-160)))
        self.page=ScrollPage(self.shell,padding=(22,10,22,14));self.page.pack(fill='both',expand=True)
        self.login_section=Fold(self.page.inner,'Conectar minha conta');self.login_section.pack_forget()
        from .editor_ui import EditorTab
        self.editor_tab=EditorTab(self,self.page.inner);self.editor_tab.frame.pack(fill='x')
        self.activity_section=Fold(self.page.inner,'Histórico e ajuda')
        self.build_activity(self.activity_section.body)
        self.reload();self.update_buttons()
        self.poll_id=root.after(150,self.poll);self.tick_id=root.after(1000,self.tick)
        root.protocol('WM_DELETE_WINDOW',self.close)

    def button(self,parent,text,command,primary=False,side='left'):
        button=ttk.Button(parent,text=text,command=command,style='Primary.TButton' if primary else 'TButton')
        button.pack(side=side,padx=(0,8),pady=4)
        self.operation_buttons.append(button)
        return button

    def scroll_to(self,widget):
        self.root.update_idletasks()
        content=self.page.canvas.bbox('all')
        if content:
            offset=widget.winfo_rooty()-self.page.inner.winfo_rooty()
            self.page.canvas.yview_moveto(max(0,offset)/max(1,content[3]))

    def navigate(self,key):
        if key=='activity':
            self.activity_section.set_open(True);self.scroll_to(self.activity_section)
        elif key=='editor':self.page.canvas.yview_moveto(0)
        self.active_page='activity' if key=='activity' else 'editor'

    def build_activity(self,parent):
        heading(parent,'Histórico e orientações','Atividade e ajuda','Consulte as análises e as alterações de links do seu canal.')
        events=card(parent,'Últimos acontecimentos','Horários mostrados no fuso deste computador. O histórico não inclui o conteúdo das mensagens.')
        self.activity=text_box(events,height=10);self.activity.configure(state='disabled')
        helpbox=card(parent,'Como trocar os links do meu canal')
        for title,text in [
            ('Analisar antes de aplicar','Escolha um canal que você administra, informe o novo link e analise o histórico. Confira a prévia antes de aplicar as alterações.'),
            ('Acompanhar as alterações','Posts pendentes aguardam aplicação. Posts alterados foram confirmados no Telegram. Posts ignorados mostram o motivo na análise.'),
            ('Restaurar os textos','Abra Análises anteriores para consultar os backups e restaurar os textos originais. Posts modificados depois da prévia são preservados.'),
            ('Pausar e fechar','Pausar interrompe as próximas alterações; a edição em andamento pode terminar. Ao fechar, a operação para. Ao reabrir, você escolhe quando continuar.'),
            ('Sua conta e seus dados','A sessão é protegida pelo usuário do Windows. Código e senha de duas etapas não são salvos. Para revogar o acesso, desconecte ou use Telegram > Configurações > Dispositivos.')]:
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
        self.operation_buttons=[button for button in self.operation_buttons if button.winfo_exists()]
        saved=bool(self.store.setting('account'))
        self.connect_button.configure(state='disabled' if self.busy or saved else 'normal')
        self.disconnect_button.configure(state='normal' if saved and not self.busy else 'disabled')
        if saved:
            self.connect_button.pack_forget();self.disconnect_button.pack(side='left')
        else:
            self.disconnect_button.pack_forget();self.connect_button.pack(side='left')
        if self.login_dialog and self.login_dialog.winfo_exists():
            self.login_cancel.configure(state='disabled' if self.busy else 'normal')
        if hasattr(self,'editor_tab'):self.editor_tab.update_buttons()

    def dispatch(self,coro,callback=None):
        if self.busy:coro.close();self.notify('Aguarde a operação atual.');return
        self.busy=True;self.spinner.pack(side='right',padx=(16,0));self.spinner.start(12)
        self.status.set('Operação em andamento. Acompanhe o progresso nesta janela…');self.update_buttons()
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
                self.reload()
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
        self.login_section.pack(fill='x',before=self.editor_tab.frame);self.login_section.set_open(True)
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
        if self.busy:return
        self.login_submit.configure(state='disabled')
        values={key:value.get() for key,value in self.login_vars.items()}
        def complete(stage):
            if not self.login_dialog or not self.login_dialog.winfo_exists():return
            self.login_submit.configure(state='normal')
            if stage=='connected':
                for value in self.login_vars.values():value.set('')
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
        if self.busy or not self.store.setting('account'):return
        choice=messagebox.askyesnocancel('Desconectar','SIM: revogar a sessão no Telegram e remover a conta local.\nNÃO: apenas remover a conta local (use se a sessão já foi revogada ou estiver offline).\nCANCELAR: manter a conta.',parent=self.root)
        if choice is not None:self.dispatch(self.runtime.engine.disconnect(revoke=choice))

    def reload(self):
        if hasattr(self,'editor_tab'):self.editor_tab.refresh()
        logs=[]
        for event in self.store.logs():
            local=datetime.fromisoformat(event['created_at']).astimezone().strftime('%d/%m %H:%M:%S')
            label=f"Registro antigo {event['job_id']}" if event['job_id'] is not None else 'Aplicativo'
            logs.append(f"{local}  ·  {label}\n{event['event']}\n")
        self.activity.configure(state='normal');self.activity.delete('1.0','end')
        self.activity.insert('1.0','\n'.join(logs) or 'Nenhuma atividade registrada. Suas operações aparecerão aqui.');self.activity.configure(state='disabled')

    def close(self):
        if self.closing:return
        if self.busy and not messagebox.askyesno('Fechar aplicativo','A alteração de links vai parar. Deseja fechar?',parent=self.root):return
        self.closing=True;self.runtime.engine.editor.cancel.set()
        for timer in (self.poll_id,self.tick_id):self.root.after_cancel(timer)
        self.status.set('Encerrando conexão. Aguarde antes de desligar o computador…');self.runtime.close()
        def wait():
            if self.runtime.thread.is_alive():self.root.after(150,wait)
            else:self.store.close();self.root.destroy()
        self.root.after(150,wait)
