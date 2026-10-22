import { BlobReader, BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { IMAGE_LIMIT, VIDEO_LIMIT, MEMORY_ZIP_LIMIT, LIMITATIONS, mediaKind, uniquePath } from './formats';
import { cleanImage } from './images';
import { VideoCleaner } from './videos';
export type BatchItem = { id: string; file: File; path: string; status: 'pending'|'processing'|'done'|'error'|'cancelled'; error?: string };
export type BatchUpdate = { id: string; status: BatchItem['status']; error?: string; bytes?: number };
export async function runBatch(items: BatchItem[], signal: AbortSignal, update: (u:BatchUpdate)=>void, diskStream?: WritableStream) {
  const writer=new ZipWriter(diskStream ?? new BlobWriter('application/zip'),{level:0,useWebWorkers:false});
  const video=new VideoCleaner(), used=new Set<string>(['relatorio-limpeza.txt']);
  const report: string[]=['RELATÓRIO DE LIMPEZA',LIMITATIONS,''];
  let bytes=0,success=0,failed=0,cancelled=0;
  try {
    for (const item of items) {
      if(signal.aborted) { update({id:item.id,status:'cancelled'}); report.push(`${item.path}: cancelado, não incluído.`); cancelled++; continue; }
      update({id:item.id,status:'processing'});
      try {
        const kind=mediaKind(item.file.name);
        if(!kind) throw new Error('Formato incompatível.');
        if(item.file.size>(kind==='image'?IMAGE_LIMIT:VIDEO_LIMIT)) throw new Error(`Arquivo acima do limite local de ${kind==='image'?'64':'256'} MB.`);
        const output=kind==='image'?await cleanImage(item.file,signal):await video.clean(item.file,signal);
        signal.throwIfAborted();
        if(!diskStream && bytes+output.size>MEMORY_ZIP_LIMIT) throw new Error('ZIP acima de 512 MB; divida o lote ou use salvar diretamente no disco.');
        const path=uniquePath(item.path,used);
        // Finish an already-started ZIP write on cancellation to avoid partial archive entries.
        await writer.add(path,new BlobReader(output),{lastModDate:new Date('1980-01-01T00:00:00Z'),level:0});
        success++; bytes+=output.size; report.push(`${item.path} -> ${path}: validado nos campos suportados.`);
        update({id:item.id,status:'done',bytes:output.size});
      } catch(e) {
        const abort=signal.aborted;
        const message=abort?'Cancelado; não incluído.':e instanceof Error?e.message:'Falha no processamento local.';
        if(abort) cancelled++; else failed++;
        report.push(`${item.path}: ${message}`); update({id:item.id,status:abort?'cancelled':'error',error:message});
      }
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    report.push('',`Recebidos: ${items.length}; sucesso: ${success}; falhas: ${failed}; cancelados: ${cancelled}; bytes dos resultados: ${bytes}.`);
    await writer.add('relatorio-limpeza.txt',new TextReader(report.join('\n')),{level:0,lastModDate:new Date('1980-01-01T00:00:00Z')});
    const output=await writer.close();
    return {blob:output instanceof Blob?output:null,bytes,success,failed,cancelled};
  } catch(e) { await writer.close().catch(()=>{}); throw e; }
  finally { video.dispose(); }
}
