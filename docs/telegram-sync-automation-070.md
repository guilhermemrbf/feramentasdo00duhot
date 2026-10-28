# Telegram Sync 0.7.0 — Automação

Solicitação de 28/10/2026: combinar cópia das 100 mensagens mais recentes com troca de links e agenda de até cinco execuções por dia. O titular confirmou copiar somente mensagens novas, sem repetir mensagens já confirmadas pela mesma automação.

## Fluxo

Automação → selecionar origem e destino → novo link HTTPS → uma a cinco vezes por dia → ajustar HH:MM → confirmar autorização → Salvar automação pausada → conferir → Ativar agenda. A ativação calcula o próximo horário futuro local do Windows; não envia imediatamente. A agenda continua somente enquanto PC e aplicativo estiverem ligados.

Cada horário captura uma janela de até 100 mensagens recentes, incluindo cada mídia e preservando álbuns inteiros. Depois filtra IDs confirmados. Não busca posts mais antigos para completar 100. Mais de 100 mensagens entre horários podem deixar posts fora da janela. Deduplicação é por automação e não identifica cópias manuais/externas. Alterar link/horários mantém os IDs confirmados.

A troca ocorre antes de publicar cópias novas, sem editar a origem e sem cabeçalho de encaminhamento. Mantém rótulo visível, formatação UTF-16, texto e legendas; troca destinos clicáveis de URLs escritas e links ocultos. Não troca @menções. Posts sem links também são copiados. Fotos, vídeos e documentos usam referências Telegram, sem download. Conteúdo protegido, botões e mídias não suportadas bloqueiam a execução para conferência.

## Agenda e falhas

Horários perdidos por mais de cinco minutos sem execução iniciada são pulados, sem acumular lotes. FloodWait definitivo adia a mesma seleção. Um álbum é uma operação de até dez mídias; cada publicação tem reserva durável antes do pedido. Um item por tick permite liberar o motor para a interface. Timeout ou resposta parcial deixam o envio bloqueado para conferência; não há retry automático ambíguo.

Agendas futuras ativas persistem entre aberturas. Seleções interrompidas sem envio incerto ficam pausadas e retomam no próximo horário após reativar. Envios incertos ficam em atenção. Conferir envio permite marcar confirmação manual ou autorizar retry, com aviso de possível duplicação. Pausar não desfaz pedido em andamento. Descartar seleção pendente preserva o ledger confirmado. Ajustar configurações exige agenda pausada e nenhuma seleção pendente; canais de uma agenda são fixos.

A conta e as permissões são conferidas a cada publicação. Ciclos e duplicidade de pares pendentes são verificados junto com as sincronizações existentes. Revogação da sessão e edição manual pelo editor exigem pausar agendas ativas. Novas tabelas SQLite são aditivas; não alteram sessões, regras, checkpoints ou backups antigos. Sem servidor remoto, ferramenta paga, agendador do Windows ou inicialização automática.

## Evidências

- Fonte do pacote: `3fe27ab71e1a5f6a162bb686cc425b5961b9e352`.
- 117 testes Python aprovados no Windows local e no CI: agenda válida/limite/virada de dia, seleção 100, deduplicação (100 + três novas = 103, sem repetição), legendas/entidades/mídias, timeout, resposta parcial, FloodWait, proteção, proprietário, reinício, migração e UI.
- Teste de integração do worker chama o tick da automação; salvar/ativar agenda futura não envia nada. Layout de três ferramentas verificado em 980×640.
- Autoteste Tk/DPAPI do código e do executável empacotado aprovados. Captura `ui-automation.png` revisada com conta fictícia, agenda pausada e horários de teste. Nenhuma sessão pessoal foi acessada ou mensagem real enviada.
- TypeScript raiz e build de produção do frontend aprovados com avisos de dependências já existentes.
- [CI Windows](https://github.com/guilhermemrbf/feramentasdo00duhot/actions/runs/40721287968) e [release 0.7.0](https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/telegram-sync-desktop-17-1).
- ZIP público lido integralmente: HTTP 200, assinatura ZIP, 19171067 bytes; SHA-256 `35d334f51709f7f280f85bb8d1e1b59190d664f6b1eb8f408b3f29cd0d2a3551`, coincidente com manifesto e digest GitHub. Binário público não executado no PC do titular; CI executou o binário que gerou.

Validação em canais reais, aparência das mídias e permissões da conta do titular continuam pendentes de teste pelo usuário. Não há prova de exactly-once distribuído; conferência manual errada pode duplicar mensagens.


## Publicação

O commit `980ff81` atualizou instruções e links verificados. Em 28/10/2026, o preview Lovable exibiu versão 0.7.0, release desktop-17-1 e seção Automação. Publicar alterações terminou com **Seu site foi atualizado**. A página pública `https://feramentasdo00duhot.lovable.app/telegram-sync` confirmou versão, link e instruções de uma a cinco execuções diárias.

Evidências locais ignoradas: `.hot-profiles/telegram-070-published.png`, `.hot-profiles/telegram-070-live.png` e `.hot-profiles/telegram-070-ui-automation.png`. O acesso público existente foi mantido. Nenhuma sessão, canal real ou credencial foi enviada ao Lovable. Supabase e Hot Profiles não foram modificados nesta entrega.
