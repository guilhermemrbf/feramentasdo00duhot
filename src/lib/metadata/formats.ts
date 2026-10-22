export const ACCEPT = '.jpg,.jpeg,.png,.webp,.mp4,.mov';
export const IMAGE_LIMIT = 64 * 1024 * 1024;
export const VIDEO_LIMIT = 256 * 1024 * 1024;
export const MEMORY_ZIP_LIMIT = 512 * 1024 * 1024;
export function mediaKind(name: string) {
  if (/\.(jpe?g|png|webp)$/i.test(name)) return 'image';
  if (/\.(mp4|mov)$/i.test(name)) return 'video';
  return null;
}
export function uniquePath(path: string, used: Set<string>) {
  const safe = path.replace(/\\/g, '/').split('/').filter(p => p && p !== '.' && p !== '..').map(p => p.replace(/[\x00-\x1f]/g, '_')).join('/') || 'arquivo';
  let result = safe, n = 2;
  while (used.has(result.toLowerCase())) {
    const dot = safe.lastIndexOf('.');
    result = dot > safe.lastIndexOf('/') ? `${safe.slice(0, dot)} (${n++})${safe.slice(dot)}` : `${safe} (${n++})`;
  }
  used.add(result.toLowerCase());
  return result;
}
export function sizeLabel(n: number) {
  return n >= 1073741824 ? `${(n / 1073741824).toFixed(2)} GB` : `${(n / 1048576).toFixed(2)} MB`;
}
export const LIMITATIONS = 'Validação de blocos EXIF pessoais, XMP, IPTC, comentários e texto. Perfis de cor, orientação e dados técnicos necessários são preservados. Vídeos: contêiner e faixas de áudio/vídeo verificados; dados dentro dos pixels, áudio, bitstream do codec e campos técnicos não são removidos universalmente. Nenhum original é incluído como limpo.';
