"use strict";
const status=document.getElementById("status"), list=document.getElementById("items");
const refresh=document.getElementById("refresh"), all=document.getElementById("all");
let current=null, busy=false;
async function scan() {
  if (busy) return;
  refresh.disabled=true;all.disabled=true;list.replaceChildren();status.textContent="Procurando mídias carregadas…";
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab || !tab.id || !MediaGrab.platform(tab.url)) { status.textContent="Abra uma página do Instagram ou TikTok.";return; }
    const data=await chrome.tabs.sendMessage(tab.id,{type:"MEDIA_GRAB_SCAN"});
    if (!data || !data.ok) throw Error("Atualize esta aba e tente novamente.");
    current=data; const available=data.items.filter(x=>x.available).length;
    status.textContent=data.items.length+" mídia(s) encontrada(s), "+available+" disponível(is).";
    for (const media of data.items) {
      const li=document.createElement("li"), row=document.createElement("div"), name=document.createElement("strong"), button=document.createElement("button"), state=document.createElement("p");
      row.className="row";name.textContent=(media.kind==="video"?"Vídeo ":"Imagem ")+media.index;
      button.textContent="Baixar";button.disabled=!media.available;
      state.className="state";state.textContent=media.available?"Arquivo direto identificado":media.reason;
      button.addEventListener("click",()=>download(media,button,state));
      row.append(name,button);li.append(row,state);list.append(li);
    }
    all.disabled=!available;
  } catch (e) { status.textContent=String(e.message || e);status.className="error"; }
  finally { refresh.disabled=false; }
}
async function track(id,state) {
  for (let attempt=0;attempt<25;attempt++) {
    await new Promise(r=>setTimeout(r,1000));
    try {
      const [entry]=await chrome.downloads.search({id});
      if (!entry) break;
      if (entry.state==="complete") {state.textContent="Concluído.";state.className="state success";return;}
      if (entry.state==="interrupted") {state.textContent="Interrompido: "+(entry.error||"erro");state.className="state error";return;}
    } catch (_) {break;}
  }
  state.textContent="Iniciado; acompanhe em Downloads do Chrome.";
}
async function download(media,button,state) {
  if (!current || button.disabled) return false;
  button.disabled=true;state.textContent="Iniciando…";
  try {
    const data=await chrome.runtime.sendMessage({type:"MEDIA_GRAB_DOWNLOAD",page:current.page,url:media.url,kind:media.kind,index:media.index});
    if (!data || !data.ok) throw Error((data && data.error)||"Falha desconhecida");
    state.textContent="Download iniciado…";void track(data.id,state);return true;
  } catch (e) {state.textContent="Falha: "+String(e.message||e);state.className="state error";button.disabled=false;return false;}
}
all.addEventListener("click",async()=>{
  if (!current || busy) return;
  busy=true;all.disabled=true;refresh.disabled=true;
  const buttons=Array.from(list.querySelectorAll("li button"));let count=0;
  for (let i=0;i<current.items.length;i++) {
    if (!current.items[i].available) continue;
    if (await download(current.items[i],buttons[i],buttons[i].closest("li").querySelector(".state"))) count++;
    await new Promise(r=>setTimeout(r,200));
  }
  busy=false;refresh.disabled=false;status.textContent=count+" downloads iniciados; confira o gerenciador do navegador.";
});
refresh.addEventListener("click",scan);void scan();
