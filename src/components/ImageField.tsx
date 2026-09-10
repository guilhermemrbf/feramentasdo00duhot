import { useRef, useState } from "react";
import { UploadCloud, Check, AlertCircle, RotateCcw } from "lucide-react";
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
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {step}
          </span>
          {label}
        </h2>
        {value && <Check className="h-4 w-4 text-green-500" />}
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition sm:flex-row sm:justify-start sm:text-left ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-secondary/50"
        }`}
      >
        {preview ? (
          <img
            src={preview}
            alt={label}
            className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover"
          />
        ) : (
          <UploadCloud className="h-10 w-10 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {preview ? "Trocar imagem" : "Enviar imagem"}
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
          {value && (
            <p className="mt-2 truncate text-xs text-muted-foreground" title={value}>
              {value}
            </p>
          )}
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
        <button
          type="button"
          onClick={clear}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Remover
        </button>
      )}
    </div>
  );
}
