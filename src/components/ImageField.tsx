import { useRef, useState } from "react";
import { UploadCloud, Check, AlertCircle, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES, uploadToCloudinary } from "@/lib/cloudinary";

interface ImageFieldProps {
  label: string;
  step: number;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
}

/** Campo de imagem que usa o uploader existente (Cloudinary) e devolve a URL pública. */
export function ImageField({ label, step, hint, value, onChange }: ImageFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setProgress(0);
    onChange("");
    try {
      const url = await uploadToCloudinary(file, setProgress);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no upload.");
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    setPreview(null);
    setError(null);
    setProgress(0);
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-xs text-primary">
            {step}
          </span>
          {label}
        </h2>
        {value && <span className="flex items-center gap-1 text-xs font-medium text-success"><Check className="h-4 w-4" /> Imagem pronta</span>}
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={`flex min-h-28 cursor-pointer items-center gap-4 rounded-md border border-dashed px-4 py-4 text-left transition ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/60 hover:bg-secondary/40"
        }`}
      >
        {preview ? (
          <img
            src={preview}
            alt={label}
            className="h-20 w-20 shrink-0 rounded-md border border-border object-cover"
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground"><UploadCloud className="h-5 w-5" /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {preview ? "Trocar imagem" : "Selecionar imagem"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hint ?? "PNG, JPG, GIF ou WEBP"}
          </p>
          {uploading && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {uploading && <p className="mt-2 flex items-center gap-1.5 text-xs text-primary"><Loader2 className="h-3 w-3 animate-spin" /> Processando imagem · {progress}%</p>}
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" /> {error}
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>

      {(preview || error) && (
        <Button
          type="button"
          onClick={clear}
          variant="ghost"
          size="sm"
          className="mt-2 px-2 text-muted-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Remover
        </Button>
      )}
    </div>
  );
}
