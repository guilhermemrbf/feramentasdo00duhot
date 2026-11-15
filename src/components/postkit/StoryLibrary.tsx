import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  storyLibraryPrefix,
  storyLibraryItem,
  validateStoryLibraryFile,
  type StoryLibraryItem,
} from "@/lib/story-library";

export function StoryLibrary({
  workspaceId,
  accountId,
  username,
  disabled,
  onChoose,
}: {
  workspaceId: string;
  accountId: string;
  username: string;
  disabled: boolean;
  onChoose: (items: StoryLibraryItem[]) => void;
}) {
  const [items, setItems] = useState<StoryLibraryItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const prefix = storyLibraryPrefix(workspaceId, accountId);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setSelected([]);
    setItems([]);
    async function load() {
      const all: StoryLibraryItem[] = [];
      for (let offset = 0; active; offset += 100) {
        const { data, error } = await supabase.storage
          .from("postkit-media")
          .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
        if (error) throw new Error("Não foi possível carregar a biblioteca de Stories.");
        for (const row of data ?? []) {
          const item = storyLibraryItem(prefix, row.name, row.metadata);
          if (item) all.push(item);
        }
        if (!data || data.length < 100) break;
      }
      if (active) setItems(all);
    }
    void load()
      .catch((e) => {
        if (active) setNotice(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [prefix, revision]);
  async function upload(files: File[]) {
    if (lock.current || disabled || !files.length) return;
    lock.current = true;
    setBusy(true);
    let uploaded = 0;
    const errors: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setNotice(`Enviando ${index + 1} de ${files.length}…`);
        try {
          const mime = await validateStoryLibraryFile(file);
          const name = file.name.replace(/[^A-Za-z0-9_.-]/g, "_").slice(-120);
          const { error } = await supabase.storage
            .from("postkit-media")
            .upload(`${prefix}/${crypto.randomUUID()}--${name}`, file, {
              contentType: mime,
              upsert: false,
            });
          if (error) throw new Error(`${file.name}: falha no envio.`);
          uploaded++;
        } catch (e) {
          errors.push(e instanceof Error ? e.message : `${file.name}: falha no envio.`);
        }
      }
      setNotice(
        `${uploaded} arquivos salvos na biblioteca de @${username}.${errors.length ? " " + errors.join(" ") : ""}`,
      );
      setRevision((n) => n + 1);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      aria-label="Biblioteca exclusiva de Stories"
    >
      <h3 className="font-semibold">Biblioteca de Stories · @{username}</h3>
      <p className="text-sm text-muted-foreground">
        Arquivos salvos nesta conta, separados dos Reels. Escolha até 45 para preparar um lote.
      </p>
      <fieldset disabled={busy || disabled} className="space-y-3">
        <label className="inline-block cursor-pointer rounded-lg border border-primary/40 px-4 py-2 text-sm font-semibold">
          Enviar para a biblioteca de Stories
          <input
            aria-label="Enviar para a biblioteca de Stories"
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.mp4,.mov,.webm"
            className="block w-full pt-2 text-xs"
            onChange={(e) => {
              void upload(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </label>
        {loading ? (
          <p role="status">Carregando biblioteca…</p>
        ) : !items.length ? (
          <p className="text-sm text-muted-foreground">
            Esta conta ainda não tem mídia de Stories. Envie os arquivos acima.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="filter-chip"
                onClick={() => setSelected(items.slice(0, 45).map((i) => i.path))}
              >
                Selecionar até 45
              </button>
              <button type="button" className="filter-chip" onClick={() => setSelected([])}>
                Limpar seleção
              </button>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {items.map((item) => (
                <label
                  key={item.path}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(item.path)}
                    disabled={!selected.includes(item.path) && selected.length >= 45}
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked ? [...old, item.path] : old.filter((p) => p !== item.path),
                      )
                    }
                  />
                  <span className="min-w-0 break-all">{item.filename}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {(item.size / 1048576).toFixed(1)} MB
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              disabled={!selected.length}
              onClick={() =>
                onChoose(selected.flatMap((path) => items.filter((item) => item.path === path)))
              }
            >
              Preparar {selected.length} Stories selecionados
            </button>
          </>
        )}
      </fieldset>
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
