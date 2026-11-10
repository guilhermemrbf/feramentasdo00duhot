import { FileText, Hash } from "lucide-react";
import { captionWithHashtags, reelHashtags } from "@/lib/postkit-reel-batch";

export function ReelCaptionFields({
  caption,
  hashtags,
  onCaptionChange,
  onHashtagsChange,
}: {
  caption: string;
  hashtags: string;
  onCaptionChange: (value: string) => void;
  onHashtagsChange: (value: string) => void;
}) {
  const tags = reelHashtags(hashtags);
  const publishedText = captionWithHashtags(caption, hashtags);

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="min-w-0 rounded-xl border border-violet-400/25 bg-violet-400/5 p-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-violet-300" aria-hidden /> Legenda (opcional)
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Escreva a descrição que você quer usar em cada Reel.
          </span>
          <textarea
            className="field mt-2 min-h-24"
            value={caption}
            maxLength={2200}
            placeholder="Ex.: Veja como montar um look para o dia a dia."
            onChange={(event) => onCaptionChange(event.target.value)}
          />
        </label>
        <div className="min-w-0 rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/5 p-3">
          <label className="block">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Hash className="size-4 text-fuchsia-300" aria-hidden /> Hashtags (opcional)
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Separe por espaço, vírgula ou quebra de linha. Elas aparecem no fim da legenda.
            </span>
            <textarea
              className="field mt-2 min-h-24"
              value={hashtags}
              maxLength={2200}
              placeholder="Ex.: #moda, #lookdodia"
              onChange={(event) => onHashtagsChange(event.target.value)}
            />
          </label>
          {tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Hashtags incluídas">
              {tags.map((tag, index) => (
                <li
                  key={index}
                  className="max-w-full break-all rounded-full bg-fuchsia-400/15 px-2.5 py-1 text-xs text-fuchsia-200"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-background/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Como aparece no Instagram</p>
          <p
            className={`text-xs tabular-nums ${publishedText.length > 2200 ? "text-amber-200" : "text-muted-foreground"}`}
          >
            {publishedText.length.toLocaleString("pt-BR")} de 2.200 caracteres
          </p>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {publishedText || "Preencha os campos acima para ver a legenda e as hashtags juntas."}
        </p>
      </div>
    </>
  );
}
