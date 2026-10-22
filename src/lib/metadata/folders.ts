export type SelectedFile = { file: File; path: string };
export function selectedFiles(files: FileList | File[]): SelectedFile[] {
  return Array.from(files).map(file=>({file,path:file.webkitRelativePath || file.name}));
}
export async function droppedFiles(transfer: DataTransfer): Promise<SelectedFile[]> {
  // Capture entries synchronously: DataTransfer is protected after the drop handler returns.
  const entries=Array.from(transfer.items).map(item=>item.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry=>Boolean(e));
  const fallback=selectedFiles(transfer.files);
  const output: SelectedFile[]=[];
  async function walk(entry: FileSystemEntry,path: string) {
    if(entry.isFile) {
      const file=await new Promise<File>((resolve,reject)=>(entry as FileSystemFileEntry).file(resolve,reject));
      output.push({file,path:path+entry.name});
    } else if(entry.isDirectory) {
      const reader=(entry as FileSystemDirectoryEntry).createReader();
      while(true) {
        const batch=await new Promise<FileSystemEntry[]>((resolve,reject)=>reader.readEntries(resolve,reject));
        if(!batch.length) break;
        for(const child of batch) await walk(child,path+entry.name+'/');
      }
    }
  }
  if(!entries.length) return fallback;
  for(const entry of entries) await walk(entry,'');
  return output;
}
