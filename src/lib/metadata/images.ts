// Lossless container editing: encoded pixel data and color profiles are unchanged.
const invalid = () => { throw new Error('Imagem corrompida ou estrutura não suportada.'); };
function join(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0; for (const p of parts) { out.set(p, offset); offset += p.length; } return out;
}
const text = (b: Uint8Array) => new TextDecoder('latin1').decode(b);
function orientation(exif: Uint8Array): number {
  const offset = text(exif.slice(0, 6)) === 'Exif\0\0' ? 6 : 0;
  if (exif.length < offset + 8) return invalid();
  const v = new DataView(exif.buffer, exif.byteOffset + offset, exif.length - offset);
  const le = v.getUint16(0) === 0x4949;
  if ((!le && v.getUint16(0) !== 0x4d4d) || v.getUint16(2, le) !== 42) return invalid();
  const start = v.getUint32(4, le);
  if (start + 2 > v.byteLength) return invalid();
  const count = v.getUint16(start, le);
  if (start + 2 + count * 12 + 4 > v.byteLength) return invalid();
  for (let i = 0; i < count; i++) {
    const p = start + 2 + i * 12;
    if (v.getUint16(p, le) === 0x112) {
      if (v.getUint16(p + 2, le) !== 3 || v.getUint32(p + 4, le) !== 1) return invalid();
      const n = v.getUint16(p + 8, le); if (n < 1 || n > 8) return invalid(); return n;
    }
  }
  return 1;
}
function minimalExif(n: number) {
  // TIFF has exactly one technical orientation tag, no linked IFD or personal data.
  return new Uint8Array([69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,n,0,0,0,0,0,0,0]);
}
function jpeg(b: Uint8Array) {
  if (b[0] !== 255 || b[1] !== 216) return invalid();
  const parts = [b.slice(0, 2)]; let p = 2, ended = false;
  while (p < b.length) {
    const start = p;
    if (b[p++] !== 255) return invalid();
    while (b[p] === 255) p++;
    const marker = b[p++];
    if (marker === 217) { parts.push(b.slice(start, p)); ended = true; break; }
    if (marker === 0 || marker === undefined || marker === 216) return invalid();
    if (marker >= 208 && marker <= 215 || marker === 1) { parts.push(b.slice(start, p)); continue; }
    if (p + 2 > b.length) return invalid();
    const length = b[p] * 256 + b[p + 1], end = p + length;
    if (length < 2 || end > b.length) return invalid();
    const payload = b.slice(p + 2, end);
    if (marker === 225 && text(payload.slice(0, 6)) === 'Exif\0\0') {
      const n = orientation(payload);
      if (n !== 1) { const e = minimalExif(n); parts.push(new Uint8Array([255,225,0,e.length + 2]), e); }
    } else if (marker === 224 && text(payload.slice(0, 5)) === 'JFIF\0') {
      if (payload.length < 14) return invalid();
      const jfif = payload.slice(0,14); jfif[12] = 0; jfif[13] = 0;
      parts.push(new Uint8Array([255,224,0,16]), jfif);
    } else if (marker === 226 && text(payload.slice(0,12)) === 'ICC_PROFILE\0' || marker === 238 && text(payload.slice(0,5)) === 'Adobe' || marker < 224 && marker !== 254) {
      parts.push(b.slice(start, end));
    }
    p = end;
    if (marker === 218) {
      const scan = p;
      while (p < b.length) {
        if (b[p] !== 255) { p++; continue; }
        let q = p + 1; while (b[q] === 255) q++;
        if (b[q] === 0 || b[q] >= 208 && b[q] <= 215) { p = q + 1; continue; }
        break;
      }
      parts.push(b.slice(scan,p));
    }
  }
  if (!ended) return invalid();
  return join(parts);
}
export function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (const x of b) { c ^= x; for (let j=0;j<8;j++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
  return (c ^ 0xffffffff) >>> 0;
}
function png(b: Uint8Array) {
  if (text(b.slice(0,8)) !== '\x89PNG\r\n\x1a\n') return invalid();
  const keep = new Set(['IHDR','PLTE','IDAT','IEND','tRNS','cHRM','gAMA','iCCP','sRGB','sBIT','acTL','fcTL','fdAT','cICP','mDCV','cLLI']);
  const parts = [b.slice(0,8)]; let p=8, header=false, pixels=false, ended=false;
  const v = new DataView(b.buffer,b.byteOffset,b.byteLength);
  while(p+12<=b.length) {
    const length=v.getUint32(p), end=p+12+length; if(end>b.length) return invalid();
    const kind=text(b.slice(p+4,p+8));
    if(crc32(b.slice(p+4,end-4))!==v.getUint32(end-4)) return invalid();
    if (!header && (kind!=='IHDR' || length!==13)) return invalid();
    if(kind==='IHDR') { if(header) return invalid(); header=true; }
    if(kind==='IDAT') pixels=true;
    if(kind==='eXIf') { if(orientation(b.slice(p+8,end-4))!==1) throw new Error('PNG com orientação EXIF: recusado para evitar alteração visual.'); }
    if(keep.has(kind)) parts.push(b.slice(p,end));
    else if(kind[0] === kind[0].toUpperCase()) return invalid();
    p=end; if(kind==='IEND') { if(length!==0) return invalid(); ended=true; break; }
  }
  if(!header || !pixels || !ended || p!==b.length) return invalid();
  return join(parts);
}
function webp(b: Uint8Array) {
  if(text(b.slice(0,4))!=='RIFF' || text(b.slice(8,12))!=='WEBP') return invalid();
  const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
  if(v.getUint32(4,true)+8!==b.length) return invalid();
  const parts: Uint8Array[]=[]; let p=12,pixels=false,n=1,hasExtended=false;
  while(p+8<=b.length) {
    const kind=text(b.slice(p,p+4)), length=v.getUint32(p+4,true), end=p+8+length+(length%2);
    if(end>b.length) return invalid();
    if(kind==='EXIF') n=orientation(b.slice(p+8,p+8+length));
    else if(['VP8X','VP8 ','VP8L','ALPH','ICCP','ANIM','ANMF'].includes(kind)) {
      const chunk=b.slice(p,end);
      if(kind==='VP8X') { if(length!==10) return invalid(); chunk[8]&=~0x0c; hasExtended=true; }
      if(['VP8 ','VP8L','ANMF'].includes(kind)) pixels=true;
      parts.push(chunk);
    }
    p=end;
  }
  if(p!==b.length || !pixels) return invalid();
  if(n!==1) {
    if(!hasExtended) return invalid();
    const extended=parts.find(c=>text(c.slice(0,4))==='VP8X'); if(extended) extended[8]|=8;
    const exif=minimalExif(n), chunk=new Uint8Array(8+exif.length); chunk.set([69,88,73,70]); new DataView(chunk.buffer).setUint32(4,exif.length,true); chunk.set(exif,8); parts.push(chunk);
  }
  const out=join([b.slice(0,12),...parts]); new DataView(out.buffer).setUint32(4,out.length-8,true); return out;
}
export function stripImageBytes(b: Uint8Array, filename: string) {
  if (/\.jpe?g$/i.test(filename)) return jpeg(b);
  if (/\.png$/i.test(filename)) return png(b);
  if (/\.webp$/i.test(filename)) return webp(b);
  throw new Error('Formato de imagem incompatível.');
}
export async function cleanImage(file: File, signal: AbortSignal) {
  signal.throwIfAborted();
  const bytes=stripImageBytes(new Uint8Array(await file.arrayBuffer()),file.name);
  // A second pass is an idempotence check for supported metadata blocks.
  const verified=stripImageBytes(bytes,file.name);
  if(bytes.length!==verified.length || bytes.some((x,i)=>x!==verified[i])) throw new Error('Falha na validação dos metadados.');
  const mime=/\.png$/i.test(file.name)?'image/png':/\.webp$/i.test(file.name)?'image/webp':'image/jpeg';
  const blob=new Blob([bytes as Uint8Array<ArrayBuffer>],{type:mime});
  const url=URL.createObjectURL(blob);
  try { const img=new Image(); img.src=url; await img.decode(); if(!img.naturalWidth || !img.naturalHeight) return invalid(); }
  finally { URL.revokeObjectURL(url); }
  signal.throwIfAborted(); return blob;
}
