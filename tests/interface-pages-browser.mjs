import {spawn} from "node:child_process";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {resolve} from "node:path";
const require=createRequire(resolve(process.env.INTELLIGENCE_PG_TEST_DEPS||".","package.json"));
const {chromium}=require("playwright-core");
const web=process.env.UI_TEST_URL||"http://127.0.0.1:4388";
const vite=process.env.UI_TEST_URL ? null : spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","4388","--strictPort"],{windowsHide:true,stdio:"ignore",env:{...process.env,VITE_SUPABASE_URL:"http://127.0.0.1:4389",VITE_SUPABASE_PUBLISHABLE_KEY:"fixture-anon"}});
if(vite) for(let i=0;i<100;i++){try{if((await fetch(web,{signal:AbortSignal.timeout(2000)})).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
const browser=await chromium.launch({executablePath:process.env.INTELLIGENCE_CHROME||"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on("pageerror",e=>{errors.push(e.message);console.error("PAGE",e.message)});
const url=web;
const out=".superpowers/sdd/2026-11-14-interface-acessivel";
try {
 await page.goto(url);await page.getByRole("heading",{name:"O que você quer fazer hoje?"}).waitFor();
 await page.waitForFunction(()=>Object.keys(document.getElementById("catalog-search")||{}).some(k=>k.startsWith("__reactProps")));
 await page.getByLabel("Buscar ferramentas por nome ou objetivo").fill("programar");
 await page.waitForFunction(()=>document.querySelectorAll("article").length<5);
 const card=page.locator("article").filter({hasText:"Automatic Post"});await card.waitFor();
 assert.equal(await card.getByRole("link").getAttribute("href"),"/automacao-instagram");
 await card.getByRole("button",{name:/Adicionar.*favoritos/}).click();
 assert.equal(await card.getByRole("button",{name:/Remover.*favoritos/}).getAttribute("aria-pressed"),"true");
 await page.getByLabel("Buscar ferramentas por nome ou objetivo").fill("");
 await page.screenshot({path:resolve(out,"home-desktop.png"),fullPage:true});
 await page.getByRole("button",{name:"Buscar ferramenta",exact:true}).click();
 await page.getByRole("textbox",{name:"Nome ou tarefa que deseja realizar"}).fill("privacy");
 const search=page.getByRole("dialog");await search.getByRole("link",{name:/Criar Tela Privacy/}).click();
 await page.getByRole("heading",{name:"Criar Tela Privacy",exact:true}).waitFor();
 await page.getByText("O que preciso para usar?",{exact:true}).click();await page.getByRole("heading",{name:"Antes de começar",exact:true}).waitFor();
 for(const path of ["/criar-pagina","/image-links","/gerar-preview","/limpar-metadados","/otimizar-criativos","/mouse-hot-downloader","/telegram-sync","/email-temporario","/funil","/instagram-intelligence"]){
  for(const width of [1440,360]){
   await page.setViewportSize({width,height:900});await page.goto(url+path);await page.locator("h1").first().waitFor();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path+" transbordou em "+width);
  }
  console.log("PASS route desktop/mobile:",path);
 }
 await page.goto(url);await page.waitForFunction(()=>Object.keys(document.getElementById("catalog-search")||{}).some(k=>k.startsWith("__reactProps")));await page.getByRole("button",{name:"Abrir menu de ferramentas"}).click();
 const menu=page.getByRole("dialog");await menu.getByRole("link",{name:"Criar Tela Privacy",exact:true}).click();await page.getByRole("heading",{name:"Criar Tela Privacy",exact:true}).waitFor();assert.equal(await menu.count(),0);
 await page.screenshot({path:resolve(out,"privacy-mobile.png"),fullPage:true});
 assert.deepEqual(errors,[]);console.log("PASS: catálogo, busca, favorito, guia, navegação móvel, 10 rotas públicas (Instagram autenticado coberto pelo teste guiado) e nenhum erro de JavaScript.");
}finally{await browser.close();vite?.kill();}
