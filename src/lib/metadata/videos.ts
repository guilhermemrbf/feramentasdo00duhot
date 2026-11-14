import type { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';
import { VIDEO_LIMIT } from './formats';

type ProbeStream = { codec_type: string; codec_name: string; width?: number; height?: number; avg_frame_rate?: string; sample_rate?: string; channels?: number; tags?: Record<string,string>; side_data_list?: unknown[] };
type Probe = { error?: unknown; streams: ProbeStream[]; chapters?: unknown[]; format: { duration: string; format_name?: string; tags?: Record<string,string> } };
const technicalTags = new Set(['major_brand','minor_version','compatible_brands','language','handler_name','vendor_id']);
export function validateVideoProbe(before: Probe, after: Probe) {
  const input = before.streams.filter(s=>s.codec_type==='video' || s.codec_type==='audio');
  if (!input.some(s=>s.codec_type==='video') || input.length!==before.streams.length) throw new Error('Vídeo com faixas extras não suportadas; recusado para evitar perda de conteúdo.');
  if (input.length!==after.streams.length || Math.abs(Number(before.format.duration)-Number(after.format.duration))>0.05 || !Number.isFinite(Number(after.format.duration))) throw new Error('Duração ou faixas alteradas; resultado recusado.');
  input.forEach((s,i)=> {
    const o=after.streams[i];
    for (const key of ['codec_type','codec_name','width','height','avg_frame_rate','sample_rate','channels'] as const) {
      if (s[key]!==o[key]) throw new Error('Características de áudio/vídeo alteradas; resultado recusado.');
    }
    if (JSON.stringify(s.side_data_list ?? [])!==JSON.stringify(o.side_data_list ?? [])) throw new Error('Orientação ou dados de cor alterados; resultado recusado.');
  });
  if (after.chapters?.length) throw new Error('Capítulos persistiram; resultado recusado.');
  const isWebM = after.format.format_name?.split(',').includes('webm');
  const verifyTags = (tags: Record<string, string> | undefined, scope: 'format' | 'stream') => {
    for (const [name, value] of Object.entries(tags ?? {})) {
      const key = name.toLowerCase();
      if (technicalTags.has(key)) continue;
      // The WebM muxer writes these technical fields even with metadata copying disabled.
      if (isWebM && scope === 'format' && key === 'encoder' && value === 'Lavf') continue;
      if (isWebM && scope === 'stream' && key === 'duration' && /^\d+:\d{2}:\d{2}\.\d{9}$/.test(value)) continue;
      throw new Error('Metadados não eliminados; resultado recusado.');
    }
  };
  verifyTags(after.format.tags, 'format');
  after.streams.forEach(stream => verifyTags(stream.tags, 'stream'));
}
export class VideoCleaner {
  private ffmpeg: FFmpeg | null = null;
  dispose() { this.ffmpeg?.terminate(); this.ffmpeg=null; }
  async clean(file: File, signal: AbortSignal): Promise<Blob> {
    signal.throwIfAborted();
    if (file.size > VIDEO_LIMIT) throw new Error('Vídeo acima do limite local de 256 MB.');
    const abort=()=>this.dispose(); signal.addEventListener('abort',abort,{once:true});
    try {
      if (!this.ffmpeg?.loaded) {
        this.dispose();
        const { FFmpeg }=await import('@ffmpeg/ffmpeg'); signal.throwIfAborted();
        this.ffmpeg=new FFmpeg();
        await this.ffmpeg.load({coreURL,wasmURL});
      }
      const ff=this.ffmpeg; signal.throwIfAborted();
      const extension = /\.mov$/i.test(file.name) ? 'mov' : /\.webm$/i.test(file.name) ? 'webm' : 'mp4';
      const mime = extension === 'mov' ? 'video/quicktime' : extension === 'webm' ? 'video/webm' : 'video/mp4';
      const input = `input.${extension}`, output = `output.${extension}`;
      // WORKERFS mounts the original File read-only; no full input copy in WASM memory.
      const { FFFSType }=await import('@ffmpeg/ffmpeg');
      const probe = async (path: string, report: string): Promise<Probe> => {
        // Core 0.12.10 can return -1 for a successful ffprobe. Require a fresh, complete report.
        const code = await ff.ffprobe([
          '-v', 'error', '-show_error', '-show_streams', '-show_format', '-show_chapters',
          '-of', 'json', path, '-o', report,
        ], 60000);
        if (code !== 0 && code !== -1) throw new Error('Não foi possível validar o contêiner do vídeo.');
        try {
          const data = await ff.readFile(report, 'utf8');
          if (typeof data !== 'string') throw new Error();
          const parsed = JSON.parse(data) as Probe;
          if (!parsed.error && Array.isArray(parsed.streams) && parsed.streams.length &&
              Number.isFinite(Number(parsed.format?.duration)) && Number(parsed.format.duration) > 0) {
            return parsed;
          }
        } catch {
          signal.throwIfAborted();
        }
        throw new Error('Vídeo corrompido ou sem faixas válidas.');
      };
      try {
        await ff.createDir('/source');
        if (!(await ff.mount(FFFSType.WORKERFS, { files: [new File([file], input)] }, '/source'))) {
          throw new Error('Não foi possível abrir o arquivo no processador local.');
        }
        const before=await probe(`/source/${input}`, "input-probe.json");
        if(before.streams.some(s=>!['video','audio'].includes(s.codec_type))) throw new Error('Vídeo com faixas extras não suportadas.');
        const code=await ff.exec(['-v','error','-i',`/source/${input}`,'-map','0','-c','copy','-map_metadata','-1','-map_metadata:s','-1','-map_chapters','-1','-fflags','+bitexact','-flags:v','+bitexact','-flags:a','+bitexact','-y',output],120000);
        signal.throwIfAborted();
        if(code!==0) throw new Error('Não foi possível limpar este vídeo sem recodificar.');
        const after=await probe(output, "output-probe.json"); validateVideoProbe(before,after);
        // Decode every audio/video packet, without changing the exported stream-copy file.
        if(await ff.exec(['-v','error','-xerror','-i',output,'-map','0:v','-map','0:a?','-f','null','-'],120000)!==0) throw new Error('Vídeo incompleto ou corrompido; resultado recusado.');
        const data=await ff.readFile(output);
        if(typeof data==='string' || !data.length) throw new Error('Vídeo vazio; resultado recusado.');
        signal.throwIfAborted();
        return new Blob([data as Uint8Array<ArrayBuffer>],{ type: mime });
      } finally {
        if(!signal.aborted) {
          await ff.deleteFile(output).catch(()=>{});
          await ff.deleteFile('input-probe.json').catch(()=>{});
          await ff.deleteFile('output-probe.json').catch(()=>{});
          await ff.unmount('/source').catch(()=>{}); await ff.deleteDir('/source').catch(()=>{});
        }
      }
    } catch (e) {
      if(signal.aborted) throw new DOMException('Cancelado','AbortError');
      if(e instanceof Error) throw e;
      throw new Error('Vídeo não suportado ou processamento local indisponível neste navegador.');
    } finally { signal.removeEventListener('abort',abort); }
  }
}
