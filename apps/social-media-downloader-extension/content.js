"use strict";
chrome.runtime.onMessage.addListener((message,_sender,respond) => {
  if (!message || message.type !== "MEDIA_GRAB_SCAN") return;
  try { respond({ok:true,page:location.href,items:MediaGrab.scan(document,location.href)}); }
  catch (_) { respond({ok:false,error:"Erro ao detectar mídias nesta página."}); }
});
