import { useEffect, useRef, useState } from 'react';
import { Download, FolderOpen, Loader2, Play, RotateCcw, Square, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCEPT, LIMITATIONS, sizeLabel } from '@/lib/metadata/formats';
import { droppedFiles, selectedFiles, type SelectedFile } from '@/lib/metadata/folders';
import type { BatchItem } from '@/lib/metadata/batch';
import { deliverZip } from '@/lib/metadata/download';

type DiskPicker = { showSaveFilePicker?: (options: {suggestedName:string;types:{description:string;accept:Record<string,string[]>}[]})=>Promise<{createWritable:()=>Promise<WritableStream>}> };
export function BatchCleaner() {
  const [items,setItems]=useState<BatchItem[]>([]),[busy,setBusy]=useState(false),[reading,setReading]=useState(false);
  const [phase,setPhase]=useState(''),[error,setError]=useState(''),[blob,setBlob]=useState<Blob|null>(null);
  const [bytes,setBytes]=useState(0),[disk,setDisk]=useState(false),[diskAvailable,setDiskAvailable]=useState(false);
  const input=useRef<HTMLInputElement>(null),folder=useRef<HTMLInputElement>(null),controller=useRef<AbortController|null>(null),running=useRef(false);
  useEffect(()=> { setDiskAvailable(Boolean((window as Window & DiskPicker).showSaveFilePicker)); return ()=>controller.current?.abort(); },[]);
  const add=(files:SelectedFile[])=> {
    if(running.current) return;
    setBlob(null);setPhase('');setError('');setBytes(0);
    setItems(current=> {
      const keys=new Set(current.map(i=>`${i.path}\0${i.file.size}\0${i.file.lastModified}`));
      const next:BatchItem[]=[];
      for(const {file,path} of files) {
        const key=`${path}\0${file.size}\0${file.lastModified}`;
        if(keys.has(key)) continue; keys.add(key);
        next.push({id:crypto.randomUUID(),file,path,status:'pending'});
      }
      return [...current.map(i=>({...i,status:'pending' as const,error:undefined})),...next];
    });
  };
  const start=async()=> {
    if(running.current || !items.length) return;
    running.current=true;setBusy(true);setBlob(null);setBytes(0);setError('');setPhase('Preparando limpeza...');
    const abort=new AbortController();controller.current=abort;
    let stream:WritableStream|undefined;
    try {
      if(disk) {
        const picker=(window as Window & DiskPicker).showSaveFilePicker;
        if(!picker) throw new Error('Salvar diretamente no disco não está disponível.');
        const handle=await picker({suggestedName:'metadados-removidos.zip',types:[{description:'Arquivo ZIP',accept:{'application/zip':['.zip']}}]});
        stream=await handle.createWritable();
      }
      abort.signal.throwIfAborted();
      setItems(current=>current.map(i=>({...i,status:'pending',error:undefined})));
      setPhase('Limpeza em andamento');
      const {runBatch}=await import('@/lib/metadata/batch');
      const result=await runBatch(items,abort.signal,update=> {
        setItems(current=>current.map(i=>i.id===update.id?{...i,status:update.status,error:update.error}:i));
        if(update.bytes) setBytes(n=>n+(update.bytes ?? 0));
      },stream);
      setBlob(result.blob);
      setPhase(abort.signal.aborted?'Processamento cancelado — ZIP parcial disponível':stream?'Processamento concluído! ZIP salvo no disco.':'Processamento concluído!');
    } catch(e) {
      if(stream) await stream.abort().catch(()=>{});
      setPhase(abort.signal.aborted?'Processamento cancelado':'');
      if(!abort.signal.aborted && (e as DOMException).name!=='AbortError') setError(e instanceof Error?e.message:'Não foi possível concluir o ZIP.');
    } finally {running.current=false;setBusy(false);controller.current=null;}
  };
  const done=items.filter(i=>i.status==='done').length,failed=items.filter(i=>i.status==='error').length,cancelled=items.filter(i=>i.status==='cancelled').length;
  const attempted=done+failed,remaining=items.length-attempted-cancelled,progress=items.length?Math.floor(attempted/items.length*100):0;
  const total=items.reduce((n,i)=>n+i.file.size,0),current=items.find(i=>i.status==='processing');
  return <section className="mt-12 border-t border-border pt-8" aria-labelledby="batch-title">
    <h2 id="batch-title" className="font-display text-2xl font-semibold">Limpeza de Metadados em Massa</h2>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Envie várias imagens ou vídeos de uma só vez, remova os metadados e baixe todos os arquivos processados em um único ZIP.</p>
    <div className="mt-6 flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy||reading} onClick={()=>input.current?.click()}><UploadCloud/>Selecionar arquivos</Button>
      <Button variant="outline" disabled={busy||reading} onClick={()=>folder.current?.click()}><FolderOpen/>Selecionar pasta completa</Button>
      <Button variant="ghost" size="icon" title="Limpar seleção" aria-label="Limpar seleção" disabled={busy||reading||!items.length} onClick={()=>{setItems([]);setBlob(null);setPhase('');setBytes(0);setError('');}}><RotateCcw/></Button>
    </div>
    <input ref={input} type="file" multiple className="hidden" aria-label="Arquivos para limpeza em massa" onChange={e=>{if(e.target.files)add(selectedFiles(e.target.files));e.target.value='';}} />
    <input ref={folder} type="file" multiple {...{webkitdirectory:'',directory:''}} className="hidden" aria-label="Pasta para limpeza em massa" onChange={e=>{if(e.target.files)add(selectedFiles(e.target.files));e.target.value='';}} />
    <div onDragOver={e=>e.preventDefault()} onDrop={async e=>{e.preventDefault();if(busy||reading)return;setReading(true);try{add(await droppedFiles(e.dataTransfer));}catch{setError('Não foi possível ler esta pasta. Use Selecionar pasta completa.');}finally{setReading(false);}}} className="mt-4 flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-5 text-center">
      <UploadCloud className="size-6 text-primary"/><p className="mt-3 text-sm">{reading?'Lendo pasta...':'Arraste arquivos ou pastas aqui'}</p>
      <p className="mt-1 text-xs text-muted-foreground">JPG, JPEG, PNG, WEBP · MP4, MOV</p>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"><span>Arquivos selecionados: <strong>{items.length.toLocaleString('pt-BR')}</strong></span><span>Tamanho total: <strong>{sizeLabel(total)}</strong></span></div>
    <p className="mt-4 text-xs leading-5 text-muted-foreground">Processamento local, um arquivo por vez. Limites por arquivo: imagem 64 MB; vídeo 256 MB. ZIP no navegador: até 512 MB de resultados. Pastas dependem do suporte do navegador. Vídeos grandes podem exigir bastante memória e tempo; divida lotes de centenas ou milhares de arquivos.</p>
    {(total>256*1048576||items.length>=500)&&<p className="mt-3 text-sm text-destructive">Lote grande: mantenha esta aba aberta e divida a seleção se houver falta de memória. Em celulares, prefira lotes menores.</p>}
    {diskAvailable&&<label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={disk} disabled={busy} onChange={e=>setDisk(e.target.checked)}/>Salvar ZIP diretamente no disco (evita acumular o ZIP na memória)</label>}
    <div className="mt-5 flex flex-wrap gap-2">
      <Button disabled={!items.length||busy||reading} onClick={start}>{busy?<Loader2 className="animate-spin"/>:<Play/>}Iniciar limpeza em massa</Button>
      {busy&&<Button variant="outline" onClick={()=>{controller.current?.abort();setPhase('Cancelando processamento...');}}><Square/>Cancelar processamento</Button>}
      {blob&&<Button variant="secondary" onClick={()=>void deliverZip(blob).catch(()=>setError('Não foi possível baixar o ZIP neste navegador.'))}><Download/>Baixar ZIP com arquivos limpos</Button>}
    </div>
    {(phase||error)&&<div className="mt-5" role="status" aria-live="polite"><p className="text-sm font-semibold">{phase}</p>{error&&<p className="mt-2 text-sm text-destructive">{error}</p>}</div>}
    {items.length>0&&<>
      <progress className="mt-4 h-2 w-full accent-primary" max={100} value={progress} aria-label="Progresso da limpeza em massa"/>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><span>Processados: {done}</span><span>Pendentes: {remaining}</span><span>Com erro: {failed}</span><span>Progresso: {progress}%</span></div>
      {cancelled>0&&<p className="mt-2 text-xs text-muted-foreground">Cancelados: {cancelled}</p>}
      <p className="mt-3 truncate text-xs text-muted-foreground">{current?`Arquivo atual: ${current.path}`:`Tamanho dos resultados: ${sizeLabel(bytes)}`}</p>
      <details className="mt-4 border-y border-border py-3"><summary className="cursor-pointer text-sm">Arquivos e resultados ({items.length})</summary><div className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs">{items.slice(0,100).map(item=><div key={item.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-2"><span className="min-w-0 break-all">{item.path}</span><span className={item.status==='error'?'text-destructive':'text-muted-foreground'}>{item.error??({pending:'Pendente',processing:'Processando',done:'Validado nos campos suportados',error:'Erro',cancelled:'Cancelado'}[item.status])}</span></div>)}{items.length>100&&<p>Lista limitada a 100 itens; o relatório no ZIP inclui todos os arquivos.</p>}</div></details>
    </>}
    <p className="mt-5 text-xs leading-5 text-muted-foreground">{LIMITATIONS} PNG com orientação EXIF não padrão é recusado para preservar a aparência. O ZIP inclui relatorio-limpeza.txt com os resultados e limitações.</p>
  </section>;
}
