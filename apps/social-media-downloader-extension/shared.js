(function (root) {
"use strict";
function platform(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (["www.instagram.com","instagram.com"].includes(u.hostname)) return "instagram";
    if (["www.tiktok.com","tiktok.com"].includes(u.hostname)) return "tiktok";
  } catch (_) {}
  return null;
}
function safeUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch (_) { return null; }
}
function getSource(el) {
  const candidates = [el.currentSrc,el.src,el.getAttribute && el.getAttribute("src")];
  if (el.tagName.toLowerCase() === "video" && el.querySelectorAll) {
    for (const node of el.querySelectorAll("source[src]")) candidates.push(node.src);
  }
  for (const source of candidates) {
    const url = safeUrl(source);
    if (url) return url;
  }
  return null;
}
function filename(page,kind,index,url) {
  const p = platform(page), media = safeUrl(url);
  if (!p || !media || !["image","video"].includes(kind) || !Number.isInteger(index) || index < 1 || index > 80) throw Error("Mídia inválida.");
  const parts = new URL(page).pathname.split("/").filter(Boolean);
  const marker = parts.findIndex(x => ["p","reel","tv","video","photo","stories"].includes(x));
  const raw = marker >= 0 && parts[marker+1] ? parts[marker+1] : (parts[parts.length-1] || "pagina");
  const id = raw.replace(/[^a-zA-Z0-9_-]/g,"").slice(0,45) || "pagina";
  const path = new URL(media).pathname;
  const match = path.match(/\.(mp4|mov|webm|jpe?g|png|webp)$/i);
  const ext = match ? match[1].toLowerCase().replace("jpeg","jpg") : (kind === "video" ? "mp4" : "jpg");
  return "00-do-hot/" + p + "/" + id + "-" + kind + "-" + String(index).padStart(2,"0") + "." + ext;
}
function scan(doc,page) {
  if (!platform(page)) return [];
  const results=[], seen=new Set();
  const dedicated = /\/(p|reel|tv|video|photo|stories)\//.test(new URL(page).pathname);
  for (const el of doc.querySelectorAll("video,img")) {
    if (results.length >= 80) break;
    const tag = el.tagName.toLowerCase(), kind = tag === "video" ? "video" : "image";
    if (tag === "img") {
      const container = el.closest && el.closest('article, [role="dialog"], a[href*="/p/"], a[href*="/reel/"], a[href*="/video/"], a[href*="/photo/"], [data-e2e="photo-mode"], [data-e2e="video-feed-item"]');
      if (!container && !dedicated) continue;
      const rect = el.getBoundingClientRect();
      if ((rect.width > 0 && rect.width < 200) || (rect.height > 0 && rect.height < 160) || el.naturalWidth < 240 || el.naturalHeight < 240) continue;
    }
    const url = getSource(el);
    if (url && !seen.has(url)) {
      seen.add(url);
      results.push({kind,url,index:results.length+1,available:true});
    } else if (!url && tag === "video" && String(el.currentSrc || el.src || "").startsWith("blob:")) {
      results.push({kind,url:null,index:results.length+1,available:false,reason:"Vídeo blob:/streaming: nenhum URL direto está disponível neste elemento."});
    }
  }
  return results;
}
root.MediaGrab = Object.freeze({platform,safeUrl,filename,scan});
})(globalThis);
