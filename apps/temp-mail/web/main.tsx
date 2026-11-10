import { createRoot } from "react-dom/client";
import { Mail, ShieldCheck } from "lucide-react";
import { Inbox } from "./inbox";
import { Admin } from "./admin";
import { Policies } from "./policies";
import "./styles.css";

function App() {
  const path = window.location.pathname;
  const admin = path.startsWith("/admin");
  const policies = path === "/privacidade" || path === "/uso-aceitavel";
  return (
    <>
      <a href="#conteudo" className="skip">Pular para o conteúdo</a>
      <header className="topbar">
        <div className="frame topbar-inner">
          <a href="/" className="brand"><span className="brand-icon"><Mail size={23} /></span>
            <span>Correio Temporário<small>UMA FERRAMENTA 00DUHOT</small></span></a>
          <nav aria-label="Navegação principal">
            <a href="/" aria-current={path === "/" ? "page" : undefined}>Caixa de entrada</a>
            <a href="/privacidade" aria-current={path === "/privacidade" ? "page" : undefined}>Privacidade</a>
          </nav>
        </div>
      </header>
      <main className="frame content" id="conteudo">
        {admin ? <Admin /> : policies ? <Policies privacy={path === "/privacidade"} /> : <Inbox />}
      </main>
      <footer className="frame footer">
        <span><ShieldCheck size={17} /> 00duHot · Correio Temporário</span>
        <nav aria-label="Links institucionais"><a href="/uso-aceitavel">Uso aceitável</a><a href="/admin">Administração</a></nav>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
