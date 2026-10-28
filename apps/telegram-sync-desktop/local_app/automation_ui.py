import json
import tkinter as tk
from datetime import datetime
from tkinter import ttk, messagebox
from .domain import UserError
from .design import card, table, Fold, readable_count


PRESETS={1:['09:00'],2:['09:00','18:00'],3:['09:00','13:00','18:00'],4:['09:00','12:00','15:00','18:00'],5:['09:00','12:00','15:00','18:00','21:00']}
STATES={'paused':'Pausada','active':'Agenda ativa','attention':'Precisa de atenção','cancelled':'Encerrada'}


class AutomationTab:
    def __init__(self,window,parent):
        self.window=window;self.db=window.runtime.engine.automation.db;self.identifier=None
        self.frame=ttk.Frame(parent)
        self.source=tk.StringVar();self.destination=tk.StringVar();self.target=tk.StringVar()
        self.frequency=tk.StringVar(value='2');self.times=tk.StringVar(value='09:00, 18:00');self.authorized=tk.BooleanVar()
        form=card(self.frame,'Automação','Copia apenas mensagens novas entre as 100 mais recentes e troca seus links, de uma a cinco vezes ao dia.')
        fields=ttk.Frame(form,style='Card.TFrame');fields.pack(fill='x')
        for index,(label,variable) in enumerate([('Canal / grupo de origem',self.source),('Canal / grupo de destino',self.destination)]):
            fields.columnconfigure(index,weight=1,uniform='auto-channel')
            block=ttk.Frame(fields,style='Card.TFrame',padding=(0,0,10 if index==0 else 0,0));block.grid(row=0,column=index,sticky='ew')
            ttk.Label(block,text=label,style='Card.TLabel').pack(anchor='w')
            line=ttk.Frame(block,style='Card.TFrame');line.pack(fill='x',pady=(4,7))
            ttk.Entry(line,textvariable=variable,width=16).pack(side='left',fill='x',expand=True,padx=(0,6))
            window.button(line,'Selecionar…',lambda var=variable:window.choose_channel(var))
        line=ttk.Frame(form,style='Card.TFrame');line.pack(fill='x',pady=3)
        ttk.Label(line,text='Novo link HTTPS',style='Card.TLabel',width=20).pack(side='left')
        ttk.Entry(line,textvariable=self.target).pack(side='left',fill='x',expand=True)
        line=ttk.Frame(form,style='Card.TFrame');line.pack(fill='x',pady=6)
        ttk.Label(line,text='Vezes por dia',style='Card.TLabel').pack(side='left',padx=(0,8))
        frequency=ttk.Combobox(line,textvariable=self.frequency,values=['1','2','3','4','5'],state='readonly',width=3);frequency.pack(side='left',padx=(0,16))
        frequency.bind('<<ComboboxSelected>>',lambda _:self.times.set(', '.join(PRESETS[int(self.frequency.get())])))
        ttk.Label(line,text='Horários locais (HH:MM)',style='Card.TLabel').pack(side='left',padx=(0,8))
        ttk.Entry(line,textvariable=self.times).pack(side='left',fill='x',expand=True)
        ttk.Checkbutton(form,text='Tenho autorização para copiar estas publicações e trocar os links.',variable=self.authorized).pack(anchor='w',pady=5)
        actions=ttk.Frame(form,style='Card.TFrame');actions.pack(fill='x')
        self.save_button=window.button(actions,'Salvar automação pausada',self.save,True)
        window.button(actions,'Nova automação',self.clear)
        ttk.Label(form,text='Mantenha o PC e o aplicativo ligados. Álbuns ficam inteiros; cada mídia conta no limite de 100. Não repete mensagens confirmadas. Troca o destino dos links clicáveis, mantendo o texto visível. Não altera a origem.',style='CardMuted.TLabel',wraplength=900).pack(fill='x',pady=(7,0))
        listing=card(self.frame,'Suas automações','Salvar não envia mensagens. Ative a agenda para executar nos próximos horários.')
        actions=ttk.Frame(listing,style='Card.TFrame');actions.pack(fill='x')
        self.activate_button=window.button(actions,'Ativar agenda',lambda:self.control('activate'),True)
        self.pause_button=window.button(actions,'Pausar',lambda:self.control('pause'))
        self.review_button=window.button(actions,'Conferir envio',self.review)
        self.tree=table(listing,[('source','Origem',200),('destination','Destino',200),('state','Estado',150),('next','Próxima execução',150),('sent','Copiadas',80)],height=3)
        self.tree.bind('<<TreeviewSelect>>',self.select)
        self.detail=tk.StringVar(value='Selecione uma automação para conferir agenda, link e último resultado.')
        ttk.Label(listing,textvariable=self.detail,style='CardMuted.TLabel',wraplength=900,justify='left').pack(fill='x',pady=(7,0))
        extra=Fold(listing,'Opções de recuperação')
        window.button(extra.body,'Descartar seleção pendente',lambda:self.control('discard'))
        ttk.Label(extra.body,text='Pause primeiro. Descarta somente a seleção ainda não concluída; mantém o registro de mensagens já copiadas. Envios sem confirmação precisam ser conferidos antes.',style='CardMuted.TLabel',wraplength=850).pack(fill='x')
        self.refresh()

    def clear(self):
        self.identifier=None;self.source.set('');self.destination.set('');self.target.set('');self.authorized.set(False)
        self.frequency.set('2');self.times.set('09:00, 18:00')
        self.tree.selection_remove(self.tree.selection());self.update_buttons()

    def save(self):
        if not self.window.store.setting('account'):
            self.window.login();self.window.notify('Conecte o Telegram antes de salvar a automação.');return
        values=[value.strip() for value in self.times.get().split(',')]
        if len(values)!=int(self.frequency.get()):
            self.window.notify('Informe a mesma quantidade de horários escolhida em Vezes por dia.',True);return
        def done(identifier):
            self.identifier=identifier;self.authorized.set(False);self.refresh();self.tree.selection_set(str(identifier))
            self.window.notify('Automação salva e pausada. Confira a agenda e clique em Ativar agenda.')
        self.window.dispatch(self.window.runtime.engine.automation.save(self.source.get(),self.destination.get(),self.target.get(),values,self.authorized.get(),self.identifier),done)

    def selected(self):
        chosen=self.tree.selection()
        if not chosen:raise UserError('Selecione uma automação.')
        return self.db.row(int(chosen[0]))

    def select(self,_event=None):
        try:row=self.selected()
        except UserError:return
        if self.identifier!=row['id']:
            self.identifier=row['id'];self.source.set(row['source']);self.destination.set(row['destination']);self.target.set(row['target'])
            times=json.loads(row['times']);self.frequency.set(str(len(times)));self.times.set(', '.join(times));self.authorized.set(False)
        self.show_detail(row);self.update_buttons()

    def control(self,action):
        try:
            row=self.selected()
            if action=='activate' and not self.window.store.setting('account'):raise UserError('Conecte sua conta Telegram antes de ativar a agenda.')
            if action=='discard' and not messagebox.askyesno('Descartar seleção pendente',f"{row['source_title']} → {row['destination_title']}\nDescartar a seleção pendente, mantendo o registro dos envios confirmados?",parent=self.window.root):return
            self.db.control(row['id'],action)
            self.refresh()
            self.window.notify('Agenda ativada: aguarde o próximo horário local. Uma seleção pendente será retomada nesse horário.' if action=='activate' else 'Automação pausada ou seleção descartada. Confira o resultado na lista.')
        except UserError as reason:self.window.notify(str(reason),True)

    def review(self):
        try:
            row=self.selected()
            decision=messagebox.askyesnocancel('Confira o canal de destino',f"{row['destination_title']}\n{row['pending']} mensagens sem confirmação. Abra o destino e confira todas.\n\nSim: já foram publicadas; registrar como copiadas.\nNão: não foram publicadas; autorizar nova tentativa (pode duplicar se a conferência estiver errada).\nCancelar: manter bloqueado.",parent=self.window.root)
            if decision is None:return
            self.db.resolve(row['id'],'sent' if decision else 'retry');self.refresh()
        except UserError as reason:self.window.notify(str(reason),True)

    def show_detail(self,row):
        self.detail.set(f"{row['source_title']} → {row['destination_title']}\nHorários locais: {', '.join(json.loads(row['times']))} · Link: {row['target']}\n{row['sent']} copiadas · {row['pending']} sem confirmação\n{row['note'] or 'Pausada. Ative a agenda para começar no próximo horário.'}")

    def refresh(self):
        rows=self.db.rows();selection=self.tree.selection()
        for row in rows:
            upcoming=datetime.fromtimestamp(row['next_run']).strftime('%d/%m %H:%M') if row['state']=='active' and row['next_run'] else '—'
            values=(row['source_title'],row['destination_title'],STATES[row['state']],upcoming,readable_count(row['sent']))
            if self.tree.exists(str(row['id'])):self.tree.item(str(row['id']),values=values)
            else:self.tree.insert('','end',iid=str(row['id']),values=values)
        if selection:
            row=next((row for row in rows if str(row['id'])==selection[0]),None)
            if row:self.show_detail(row)
        if hasattr(self.window,'automation_metrics'):
            for state in ('active','paused','attention'):self.window.automation_metrics[state].value.set(readable_count(sum(row['state']==state for row in rows)))
            self.window.automation_metrics['sent'].value.set(readable_count(sum(row['sent'] for row in rows)))
        self.update_buttons()

    def update_buttons(self):
        try:row=self.selected()
        except UserError:row=None
        busy=self.window.busy
        self.activate_button.configure(state='normal' if row and row['state']!='active' and not row['pending'] and not busy else 'disabled')
        self.pause_button.configure(state='normal' if row and row['state'] in ('active','attention') and not busy else 'disabled')
        self.review_button.configure(state='normal' if row and row['pending'] and row['state']=='attention' and not busy else 'disabled')
        self.save_button.configure(state='normal' if not busy and (self.identifier is None or self.db.row(self.identifier)['state']=='paused') else 'disabled')
