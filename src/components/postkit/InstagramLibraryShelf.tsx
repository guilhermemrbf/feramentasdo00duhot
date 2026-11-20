import { useMemo, useState, type ReactNode } from "react";
import { Film, FolderOpen, Folders, Search } from "lucide-react";
import { WorkspaceSelect } from "@/components/ui/workspace-select";

export type ReelFolderOption = { value: string; label: string; count: number };
type ReelFile = { id: string; name: string; size: number; type: string };

const pageSize = 24;

export function InstagramLibraryShelf({
  folders,
  activeFolder,
  onFolder,
  videos,
  loaded,
  selectedIds,
  selectedCount,
  onSelect,
  formatSize,
  empty,
  children,
}: {
  folders: ReelFolderOption[];
  activeFolder: string;
  onFolder: (id: string) => void;
  videos: readonly ReelFile[];
  loaded: boolean;
  selectedIds: ReadonlySet<string> | null;
  selectedCount: number;
  onSelect?: (id: string, checked: boolean) => void;
  formatSize: (size: number) => string;
  empty: ReactNode;
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(pageSize);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return term
      ? videos.filter((video) => video.name.toLocaleLowerCase("pt-BR").includes(term))
      : videos;
  }, [query, videos]);
  const currentFolder = folders.find(({ value }) => value === activeFolder);
  const totalSize = useMemo(() => videos.reduce((total, video) => total + video.size, 0), [videos]);
  const selectFolder = (value: string) => {
    onFolder(value);
    setQuery("");
    setLimit(pageSize);
  };

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)]">
      <section
        aria-label="Pastas da biblioteca"
        className="min-w-0 rounded-xl border border-border bg-card p-3 lg:self-start"
      >
        <h3 className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold">
          <Folders className="size-4 text-brand-red" aria-hidden /> Pastas
        </h3>
        <div className="lg:hidden">
          <WorkspaceSelect
            label="Pasta da biblioteca"
            value={activeFolder}
            options={folders.map(({ value, label, count }) => ({
              value,
              label: loaded ? `${label} (${count})` : label,
            }))}
            onValueChange={selectFolder}
          />
        </div>
        <ul className="hidden space-y-1 lg:block">
          {folders.map(({ value, label, count }) => (
            <li key={value}>
              <button
                type="button"
                aria-pressed={value === activeFolder}
                onClick={() => selectFolder(value)}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-transparent px-2.5 text-left text-sm text-muted-foreground hover:bg-secondary aria-pressed:border-brand-red/30 aria-pressed:bg-primary/10 aria-pressed:text-foreground"
              >
                <FolderOpen className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate" title={label}>
                  {label}
                </span>
                {loaded && <span className="text-xs tabular-nums">{count}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section
        aria-label="Vídeos desta pasta"
        className="min-w-0 rounded-xl border border-border bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold">
              {currentFolder?.label ?? "Todos os vídeos"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {loaded
                ? `${videos.length} ${videos.length === 1 ? "vídeo" : "vídeos"} · ${formatSize(totalSize)}${onSelect ? ` · ${selectedCount} selecionados` : ""}`
                : "Carregando a biblioteca…"}
            </p>
          </div>
          {videos.length > 0 && (
            <label className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 text-muted-foreground focus-within:border-brand-red sm:w-auto">
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="sr-only">Buscar vídeos</span>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLimit(pageSize);
                }}
                placeholder="Buscar pelo nome"
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground focus-visible:outline-none sm:max-w-44"
              />
            </label>
          )}
        </div>
        <div className="p-4">
          {filtered.length ? (
            <>
              <ul className="grid gap-3 min-[510px]:grid-cols-2 2xl:grid-cols-3">
                {filtered.slice(0, limit).map((video) => {
                  const checked = !!onSelect && (selectedIds?.has(video.id) ?? true);
                  return (
                    <li key={video.id} className="min-w-0">
                      <label
                        className={`flex min-h-20 h-full items-center gap-3 rounded-lg border bg-background/60 p-3 ${checked ? "border-brand-red/35" : "border-border"} ${onSelect ? "cursor-pointer hover:bg-secondary/40" : ""}`}
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-brand-red">
                          <Film className="size-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold" title={video.name}>
                            {video.name}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {formatSize(video.size)} ·{" "}
                            {video.name.split(".").pop()?.toUpperCase() || video.type || "Vídeo"}
                          </span>
                        </span>
                        {onSelect && (
                          <input
                            type="checkbox"
                            aria-label={`Usar ${video.name}`}
                            className="size-4 shrink-0 accent-primary"
                            checked={checked}
                            onChange={(event) => onSelect(video.id, event.target.checked)}
                          />
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
              {filtered.length > limit && (
                <button
                  type="button"
                  onClick={() => setLimit((value) => value + pageSize)}
                  className="mt-4 min-h-10 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-secondary"
                >
                  Mostrar mais vídeos
                </button>
              )}
            </>
          ) : !loaded ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground" role="status">
              Carregando os vídeos desta conta…
            </p>
          ) : query.trim() && videos.length ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground" role="status">
              Nenhum vídeo encontrado com esse nome nesta pasta.
            </p>
          ) : (
            empty
          )}
          {children}
        </div>
      </section>
    </div>
  );
}
