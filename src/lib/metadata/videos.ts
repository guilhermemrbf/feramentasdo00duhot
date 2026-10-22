import type { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

type ProbeStream = { codec_type: string; codec_name: string; width?: number; height?: number; avg_frame_rate?: string; sample_rate?: string; channels?: number; tags?: Record<string,string>; side_data_list?: unknown[] };
type Probe = { streams: ProbeStream[]; chapters?: unknown[]; format: { duration: string; tags?: Record<string,string> } };
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
  for (const tags of [after.format.tags, ...after.streams.map(s=>s.tags)]) {
    for (const key of Object.keys(tags ?? {})) if (!technicalTags.has(key.toLowerCase())) throw new Error('Metadados não eliminados; resultado recusado.');
  }
}
export class VideoCleaner {
  private ffmpeg: FFmpeg | null = null;
  dispose() { this.ffmpeg?.terminate(); this.ffmpeg=null; }
  async clean(file: File, signal: AbortSignal): Promise<Blob> {
    signal.throwIfAborted();
    const abort=()=>this.dispose(); signal.addEventListener('abort',abort,{once:true});
    try {
      if (!this.ffmpeg) {
        const { FFmpeg }=await import('@ffmpeg/ffmpeg'); signal.throwIfAborted();
        this.ffmpeg=new FFmpeg();
        await this.ffmpeg.load({coreURL,wasmURL});
      }
      const ff=this.ffmpeg; signal.throwIfAborted();
      const mov=/\.mov$/i.test(file.name), input=mov?'input.mov':'input.mp4', output=mov?'output.mov':'output.mp4';
      // WORKERFS mounts the original File read-only; no full input copy in WASM memory.
      const { FFFSType }=await import('@ffmpeg/ffmpeg');
      await ff.createDir('/source');
      await ff.mount(FFFSType.WORKERFS,{files:[new File([file],input)]},'/source');
      const probe=async(path: string):Promise<Probe>=> {
        const code=await ff.ffprobe(['-v','error','-show_streams','-show_format','-show_chapters','-of','json',path,'-o','probe.json'],60000);
        if(code!==0) throw new Error('Não foi possível validar o contêiner do vídeo.');
        const data=await ff.readFile('probe.json'); await ff.deleteFile('probe.json');
        const parsed=JSON.parse(typeof data==='string'?data:new TextDecoder().decode(data)) as Probe;
        if(!parsed.streams?.length || !parsed.format) throw new Error('Vídeo corrompido ou sem faixas válidas.'); return parsed;
      };
      try {
        const before=await probe(`/source/${input}`);
        if(before.streams.some(s=>!['video','audio'].includes(s.codec_type))) throw new Error('Vídeo com faixas extras não suportadas.');
        const code=await ff.exec(['-v','error','-i',`/source/${input}`,'-map','0:v','-map','0:a?','-c','copy','-map_metadata','-1','-map_metadata:s','-1','-map_chapters','-1','-fflags','+bitexact','-flags:v','+bitexact','-flags:a','+bitexact','-y',output],120000);
        signal.throwIfAborted();
        if(code!==0) throw new Error('Não foi possível limpar este vídeo sem recodificar.');
        const after=await probe(output); validateVideoProbe(before,after);
        // Decode every audio/video packet, without changing the exported stream-copy file.
        if(await ff.exec(['-v','error','-xerror','-i',output,'-map','0:v','-map','0:a?','-f','null','-'],120000)!==0) throw new Error('Vídeo incompleto ou corrompido; resultado recusado.');
        const data=await ff.readFile(output);
        if(typeof data==='string' || !data.length) throw new Error('Vídeo vazio; resultado recusado.');
        signal.throwIfAborted();
        return new Blob([data as Uint8Array<ArrayBuffer>],{type:mov?'video/quicktime':'video/mp4'});
      } finally {
        if(!signal.aborted) {
          await ff.deleteFile(output).catch(()=>{}); await ff.deleteFile('probe.json').catch(()=>{});
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
