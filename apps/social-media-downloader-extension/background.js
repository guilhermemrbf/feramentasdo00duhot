"use strict";
importScripts("shared.js");
chrome.runtime.onMessage.addListener((message,sender,respond) => {
  if (!message || message.type !== "MEDIA_GRAB_DOWNLOAD") return;
  if (sender.id && sender.id !== chrome.runtime.id) { respond({ok:false,error:"Origem não autorizada."}); return; }
  (async () => {
    try {
      const url = MediaGrab.safeUrl(message.url);
      if (!url || !MediaGrab.platform(message.page)) throw Error("Link inválido.");
      const filename = MediaGrab.filename(message.page,message.kind,message.index,url);
      const id = await chrome.downloads.download({url,filename,saveAs:false,conflictAction:"uniquify"});
      if (!Number.isInteger(id)) throw Error("O Chrome não iniciou o download.");
      respond({ok:true,id});
    } catch (e) { respond({ok:false,error:String(e.message || "Falha ao iniciar download.")}); }
  })();
  return true;
});
