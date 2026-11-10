import { useEffect, useState } from "react";
import { api } from "./api";

export function Policies({ privacy }: { privacy: boolean }) {
  const [contact, setContact] = useState<string | null>(null);
  useEffect(() => { void api<{ abuseContact: string | null }>("/info").then((data) => setContact(data.abuseContact)).catch(() => {}); }, []);
  return <article className="card panel policy">
    <h1>{privacy ? "Privacidade" : "Uso aceitável"}</h1>
    {privacy ? <>
      <p>O serviço trata o endereço temporário, remetentes, destinatários, assuntos, conteúdo recebido e datas para disponibilizar a caixa. A criação de caixas e a conexão ao vivo são limitadas por uma impressão criptográfica do IP com validade curta.</p>
      <p>Um cookie privado e protegido identifica a caixa deste navegador. A exclusão ou expiração remove as mensagens e revoga o acesso. O painel administrativo mostra dados operacionais e não exibe o conteúdo das mensagens.</p>
      <p>Registros técnicos sem conteúdo e estatísticas são usados para manter o serviço e investigar abusos. Registros técnicos e metadados operacionais de caixas são removidos após 30 dias. Backups operacionais seguem o prazo informado pelo operador.</p>
      <p>Use o contato do operador para dúvidas ou pedidos sobre seus dados, conforme a LGPD. Não envie o cookie de acesso nem o conteúdo da sua caixa para fazer a solicitação.</p>
    </> : <>
      <p>Use endereços temporários para testes autorizados e recebimento legítimo de mensagens de baixa sensibilidade.</p>
      <p>É proibido usar este serviço para fraude, phishing, spam, distribuição de malware, criação abusiva de contas, contorno de bloqueios ou violação dos termos de outros serviços.</p>
      <p>Caixas abusivas podem ser removidas e domínios podem ser suspensos. O serviço somente recebe e-mails. Imagens remotas e anexos não são disponibilizados.</p>
    </>}
    <h2>Contato do operador</h2>
    {contact ? <p><a href={"mailto:" + contact}>{contact}</a></p> : <p>O contato é informado pelo operador no ambiente de produção.</p>}
  </article>;
}
