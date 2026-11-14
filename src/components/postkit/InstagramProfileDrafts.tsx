import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarDays, Instagram, UserRoundPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Account = { id: string; username: string };
type Video = { id: string; name: string; reelAccountId: string | null };
type ProfileDraft = {
  id: string;
  workspace_id: string;
  display_name: string;
  handle: string;
  registration_email: string | null;
  bio: string;
  product_url: string | null;
  photo_path: string | null;
  starter_reels: string[];
  reels_per_day: number;
  account_created: boolean;
  instagram_account_id: string | null;
  created_at: string;
};
type DraftInsert = Omit<ProfileDraft, "created_at" | "account_created" | "instagram_account_id">;
type DraftUpdate = Partial<Omit<ProfileDraft, "id" | "workspace_id" | "created_at">>;
type DraftDatabase = {
  public: {
    Tables: {
      instagram_profile_drafts: {
        Row: ProfileDraft;
        Insert: DraftInsert;
        Update: DraftUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
type DraftForm = {
  id: string;
  editing: boolean;
  accountId: string | null;
  name: string;
  handle: string;
  email: string;
  bio: string;
  link: string;
  photoPath: string | null;
  photo: File | null;
  reels: string[];
  daily: number;
};

const client = supabase as unknown as SupabaseClient<DraftDatabase>;
const table = "instagram_profile_drafts";
const bucket = "postkit-media";
const pageSize = 50;
const button =
  "rounded-md border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50";
const primary =
  "rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50";

async function photoFormat(file: File) {
  if (file.size === 0 || file.size > 10 * 1024 * 1024)
    throw new Error("Use uma foto de até 10 MB.");
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return ["jpg", "image/jpeg"];
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte))
    return ["png", "image/png"];
  throw new Error("Use uma foto JPG ou PNG.");
}

export function InstagramProfileDrafts({
  workspaceId,
  accounts,
  videos,
  onConnect,
  onLibrary,
  onReels,
  onStories,
}: {
  workspaceId: string;
  accounts: Account[];
  videos: Video[];
  onConnect: () => void;
  onLibrary: (accountId: string) => void;
  onReels: (accountId: string, daily: number, videoIds: string[]) => void;
  onStories: (accountId: string, productUrl: string | null) => void;
}) {
  const [drafts, setDrafts] = useState<ProfileDraft[]>([]);
  const [form, setForm] = useState<DraftForm | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [photoPreview, setPhotoPreview] = useState<{ id: string; url: string } | null>(null);
  const lock = useRef(false);
  const visible = drafts.filter((draft) =>
    (draft.display_name + " @" + draft.handle).toLowerCase().includes(filter.trim().toLowerCase()),
  );

  const refresh = useCallback(async () => {
    try {
      const {
        data,
        error: queryError,
        count,
      } = await client
        .from(table)
        .select("*", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (queryError) throw queryError;
      setDrafts(data ?? []);
      setTotal(count ?? 0);
      setError("");
    } catch {
      setError("Não foi possível carregar as fichas. Atualize a lista e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, page]);

  useEffect(() => {
    let active = true;
    void refresh();
    void supabase
      .rpc("has_workspace_role", {
        target_workspace: workspaceId,
        allowed_roles: ["owner", "admin", "editor"],
      })
      .then(({ data, error: roleError }) => {
        if (active) setCanEdit(!roleError && data === true);
      });
    return () => {
      active = false;
    };
  }, [refresh, workspaceId]);

  function openForm(draft?: ProfileDraft) {
    setError("");
    setNotice("");
    setForm({
      id: draft?.id ?? crypto.randomUUID(),
      editing: !!draft,
      accountId: draft?.instagram_account_id ?? null,
      name: draft?.display_name ?? "",
      handle: draft?.handle ?? "",
      email: draft?.registration_email ?? "",
      bio: draft?.bio ?? "",
      link: draft?.product_url ?? "",
      photoPath: draft?.photo_path ?? null,
      photo: null,
      reels: draft?.starter_reels ?? [],
      daily: draft?.reels_per_day ?? 3,
    });
  }

  function patchForm(patch: Partial<DraftForm>) {
    setForm((current) => (current ? { ...current, ...patch } : null));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form || !canEdit || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const name = form.name.trim();
      const handle = form.handle.trim().replace(/^@/, "").toLowerCase();
      const email = form.email.trim();
      if (!name || !/^[a-z0-9._]{1,30}$/.test(handle))
        throw new Error("Informe o nome e um @ com até 30 letras, números, pontos ou sublinhados.");
      if (
        (!form.editing || email) &&
        (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      )
        throw new Error("Informe um e-mail de cadastro válido.");
      if (!Number.isInteger(form.daily) || form.daily < 1 || form.daily > 10)
        throw new Error("Escolha de 1 a 10 Reels por dia.");
      let link: string | null = null;
      if (form.link.trim()) {
        let url: URL;
        try {
          url = new URL(form.link.trim());
        } catch {
          throw new Error("Informe um link HTTPS válido.");
        }
        if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2048)
          throw new Error("Informe um link HTTPS válido.");
        link = url.href;
      }
      let photoPath = form.photoPath;
      if (form.photo) {
        const [extension, mime] = await photoFormat(form.photo);
        photoPath = [workspaceId, form.id, "profile." + extension].join("/");
        const { error: uploadError } = await client.storage
          .from(bucket)
          .upload(photoPath, form.photo, { contentType: mime, upsert: true });
        if (uploadError) throw new Error("Não foi possível enviar a foto de perfil.");
      }
      const values = {
        display_name: name,
        handle,
        registration_email: email || null,
        bio: form.bio.trim(),
        product_url: link,
        photo_path: photoPath,
        starter_reels: form.reels,
        reels_per_day: form.daily,
      };
      const result = form.editing
        ? await client
            .from(table)
            .update(values)
            .eq("id", form.id)
            .eq("workspace_id", workspaceId)
            .select("id")
        : await client
            .from(table)
            .upsert(
              { ...values, id: form.id, workspace_id: workspaceId },
              { onConflict: "id", ignoreDuplicates: true },
            )
            .select("id");
      if (result.error?.code === "23505")
        throw new Error(
          result.error.message.includes("instagram_profile_drafts_workspace_email")
            ? "Este e-mail já está em outra ficha. Use um endereço diferente para cada conta."
            : "Já existe uma ficha para esse @ no espaço.",
        );
      if (result.error || (form.editing && !result.data?.length))
        throw new Error("Não foi possível salvar a ficha.");
      if (!form.editing && !result.data?.length) {
        const existing = await client
          .from(table)
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("id", form.id)
          .maybeSingle();
        if (existing.error || !existing.data)
          throw new Error("O salvamento não foi confirmado. Tente de novo.");
      }
      setForm(null);
      setPhotoPreview(null);
      await refresh();
      setNotice("Ficha salva para @" + handle + ".");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Não foi possível salvar a ficha.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function setStage(draft: ProfileDraft, account?: Account) {
    if (!canEdit || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data, error: updateError } = await client
        .from(table)
        .update({ account_created: true, ...(account ? { instagram_account_id: account.id } : {}) })
        .eq("id", draft.id)
        .eq("workspace_id", workspaceId)
        .select("id");
      if (updateError || !data?.length) throw new Error("Não foi possível atualizar a ficha.");
      await refresh();
      setNotice(
        account
          ? "Conta @" + account.username + " vinculada."
          : "Agora conecte a conta profissional na aba Contas.",
      );
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Não foi possível atualizar a ficha.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function openPhoto(draft: ProfileDraft) {
    if (!draft.photo_path) return;
    setError("");
    const { data, error: photoError } = await client.storage
      .from(bucket)
      .createSignedUrl(draft.photo_path, 300, {
        download: draft.handle + "-perfil." + draft.photo_path.split(".").at(-1),
      });
    if (photoError || !data?.signedUrl) {
      setError("Não foi possível preparar o download da foto.");
      return;
    }
    setPhotoPreview({ id: draft.id, url: data.signedUrl });
  }

  function copy(value: string, label: string) {
    void navigator.clipboard
      .writeText(value)
      .then(() => setNotice(label + " copiado."))
      .catch(() => setNotice("Selecione o conteúdo na ficha para copiar."));
  }

  const draftAccountId = form?.accountId;
  const accountVideos = draftAccountId
    ? videos.filter((video) => video.reelAccountId === draftAccountId)
    : [];
  const starterReels =
    form?.reels.filter((id) => accountVideos.some((video) => video.id === id)) ?? [];

  return (
    <section className="mt-6 space-y-5" aria-label="Novos perfis do Instagram">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Preparar um novo perfil</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Reúna em uma ficha tudo que você precisa para criar a conta e planejar as primeiras
              publicações.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              className={primary}
              disabled={busy || !!form}
              onClick={() => openForm()}
            >
              Preparar novo perfil
            </button>
          )}
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-3">
          <li className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <UserRoundPlus className="size-4 text-sky-300" /> 1. Prepare os dados
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Escolha um e-mail diferente para cada conta e guarde o nome, a foto e a bio.
            </p>
          </li>
          <li className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/5 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Instagram className="size-4 text-fuchsia-300" /> 2. Crie e conecte a conta
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Faça o cadastro no Instagram, coloque a foto e a bio e conecte a conta profissional.
            </p>
          </li>
          <li className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-emerald-300" /> 3. Organize as publicações
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Com a conta conectada, escolha quando programar Reels ou preparar Stories.
            </p>
          </li>
        </ol>
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Ambientes anteriores do Hot Profiles</summary>
          <div className="mt-2 flex flex-wrap gap-3">
            <a className="underline" href="/hot-profiles?mode=local">
              Meu computador
            </a>
            <a className="underline" href="/hot-profiles?mode=cloud">
              Nuvem
            </a>
          </div>
        </details>
        {notice && (
          <p role="status" className="mt-3 text-sm text-brand-red">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-amber-500">
            {error}
          </p>
        )}
      </div>

      {form && (
        <form
          onSubmit={(event) => void save(event)}
          className="rounded-lg border border-border bg-card p-5"
        >
          <fieldset disabled={busy} className="space-y-4">
            <h3 className="font-semibold">
              {form.editing ? "Editar os dados do perfil" : "Dados do novo perfil"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                Nome que aparece no perfil
                <input
                  required
                  maxLength={64}
                  placeholder="Ex.: Ateliê da Marina"
                  className="field mt-1"
                  value={form.name}
                  onChange={(event) => patchForm({ name: event.target.value })}
                />
              </label>
              <label className="block text-sm">
                Nome de usuário (@)
                <input
                  required
                  maxLength={31}
                  placeholder="@ateliedamarina"
                  disabled={!!form.accountId}
                  className="field mt-1"
                  value={form.handle}
                  onChange={(event) => patchForm({ handle: event.target.value })}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                E-mail para cadastrar a conta
                <input
                  type="email"
                  required={!form.editing}
                  maxLength={254}
                  autoComplete="off"
                  placeholder="perfil@seudominio.com"
                  className="field mt-1"
                  value={form.email}
                  onChange={(event) => patchForm({ email: event.target.value })}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Use um endereço que você controla e pode acessar depois. O e-mail fica visível
                  para a equipe neste espaço. Senha e códigos ficam no Instagram.
                </span>
              </label>
              <label className="block text-sm">
                Foto de perfil (JPG ou PNG)
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  className="field mt-1"
                  onChange={(event) => patchForm({ photo: event.target.files?.[0] ?? null })}
                />
              </label>
              <label className="block text-sm">
                Link para colocar na bio
                <input
                  type="url"
                  maxLength={2048}
                  placeholder="https://…"
                  className="field mt-1"
                  value={form.link}
                  onChange={(event) => patchForm({ link: event.target.value })}
                />
              </label>
            </div>
            <label className="block text-sm">
              Bio do perfil
              <textarea
                maxLength={150}
                placeholder="Conte o que as pessoas vão encontrar no perfil."
                className="field mt-1 min-h-20"
                value={form.bio}
                onChange={(event) => patchForm({ bio: event.target.value })}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                {form.bio.length}/150 caracteres
              </span>
            </label>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">
                  Primeiros Reels · {starterReels.length}/30
                </h4>
                {draftAccountId && (
                  <button
                    type="button"
                    className={button}
                    onClick={() => onLibrary(draftAccountId)}
                  >
                    Abrir biblioteca da conta
                  </button>
                )}
              </div>
              {accountVideos.length ? (
                <div className="mt-2 max-h-44 space-y-1 overflow-auto rounded-md border border-border p-2">
                  {accountVideos.map((video) => {
                    const selected = starterReels.includes(video.id);
                    return (
                      <label key={video.id} className="flex items-center gap-2 p-1 text-sm">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!selected && starterReels.length >= 30}
                          onChange={() =>
                            patchForm({
                              reels: selected
                                ? starterReels.filter((id) => id !== video.id)
                                : [...starterReels, video.id],
                            })
                          }
                        />
                        <span className="truncate">{video.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  {form.accountId
                    ? "Adicione vídeos à biblioteca desta conta para escolhê-los aqui."
                    : "Conecte o Instagram à ficha para escolher os vídeos da conta."}
                </p>
              )}
            </div>
            <label className="block max-w-48 text-sm">
              Meta de Reels por dia
              <input
                type="number"
                required
                min={1}
                max={10}
                className="field mt-1"
                value={form.daily}
                onChange={(event) => patchForm({ daily: Number(event.target.value) })}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Você escolhe os dias e horários depois que a conta estiver conectada.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={primary}>
                {busy ? "Salvando…" : "Salvar dados do perfil"}
              </button>
              <button type="button" className={button} onClick={() => setForm(null)}>
                Cancelar edição
              </button>
            </div>
          </fieldset>
        </form>
      )}

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Fichas de perfil</h3>
          <div className="flex gap-2">
            <input
              aria-label="Buscar ficha nesta página"
              className="field"
              placeholder="Buscar nesta página"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <button type="button" className={button} disabled={busy} onClick={() => void refresh()}>
              Atualizar
            </button>
          </div>
        </div>
        {loading && <p className="mt-3 text-sm text-muted-foreground">Carregando fichas…</p>}
        {!loading && !visible.length && (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma ficha encontrada.</p>
        )}
        {total > pageSize && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <button
              type="button"
              className={button}
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page + 1} de {Math.ceil(total / pageSize)}
            </span>
            <button
              type="button"
              className={button}
              disabled={(page + 1) * pageSize >= total}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </button>
          </div>
        )}
        <div className="mt-4 space-y-3">
          {visible.map((draft) => {
            const account = accounts.find(
              (item) =>
                item.id === draft.instagram_account_id &&
                item.username.toLowerCase() === draft.handle,
            );
            const match = accounts.find((item) => item.username.toLowerCase() === draft.handle);
            const status = account
              ? "Pronto para agendar"
              : match
                ? "Falta vincular a ficha"
                : draft.account_created
                  ? "Falta conectar a conta"
                  : "Falta criar no Instagram";
            return (
              <article key={draft.id} className="space-y-3 rounded-md border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">{draft.display_name}</h4>
                    <p className="text-xs text-muted-foreground">@{draft.handle}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${account ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}
                  >
                    {status}
                  </span>
                </div>
                {draft.registration_email && (
                  <p className="break-all text-xs text-muted-foreground">
                    E-mail de cadastro: {draft.registration_email}
                  </p>
                )}
                {draft.bio && (
                  <p className="whitespace-pre-wrap break-words text-sm">{draft.bio}</p>
                )}
                {draft.product_url && (
                  <p className="break-all text-xs text-muted-foreground">{draft.product_url}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {draft.starter_reels.length} Reels selecionados · até {draft.reels_per_day} por
                  dia
                </p>
                {canEdit && (
                  <p className="rounded-md bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                    {account
                      ? "A conta está vinculada. Escolha qual conteúdo quer preparar."
                      : match
                        ? `Vincule @${match.username} a esta ficha para preparar as publicações.`
                        : draft.account_created
                          ? "Conecte a conta profissional em Contas e volte para vincular esta ficha."
                          : `Use os dados da ficha para cadastrar @${draft.handle} no Instagram. Depois volte e marque a conta como criada.`}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {canEdit && (
                    <button
                      type="button"
                      className={button}
                      disabled={busy}
                      onClick={() => openForm(draft)}
                    >
                      Editar ficha
                    </button>
                  )}
                  {draft.registration_email && (
                    <button
                      type="button"
                      className={button}
                      onClick={() => copy(draft.registration_email!, "E-mail")}
                    >
                      Copiar e-mail
                    </button>
                  )}
                  {draft.bio && (
                    <button type="button" className={button} onClick={() => copy(draft.bio, "Bio")}>
                      Copiar bio
                    </button>
                  )}
                  {draft.product_url && (
                    <button
                      type="button"
                      className={button}
                      onClick={() => copy(draft.product_url!, "Link")}
                    >
                      Copiar link
                    </button>
                  )}
                  {draft.photo_path &&
                    (photoPreview?.id === draft.id ? (
                      <a className={button} href={photoPreview.url} download>
                        Baixar foto
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={button}
                        onClick={() => void openPhoto(draft)}
                      >
                        Preparar foto para baixar
                      </button>
                    ))}
                  {canEdit && !draft.account_created && !match && (
                    <>
                      <a
                        className={button}
                        href="https://www.instagram.com/accounts/emailsignup/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir cadastro no Instagram
                      </a>
                      <button
                        type="button"
                        className={primary}
                        disabled={busy}
                        onClick={() => void setStage(draft)}
                      >
                        Marcar conta como criada
                      </button>
                    </>
                  )}
                  {canEdit &&
                    (draft.account_created || match) &&
                    !account &&
                    (match ? (
                      <button
                        type="button"
                        className={primary}
                        disabled={busy}
                        onClick={() => void setStage(draft, match)}
                      >
                        Vincular @{match.username}
                      </button>
                    ) : (
                      <button type="button" className={primary} onClick={onConnect}>
                        Conectar conta profissional
                      </button>
                    ))}
                  {canEdit && account && (
                    <>
                      <button
                        type="button"
                        className={primary}
                        onClick={() =>
                          onReels(account.id, draft.reels_per_day, draft.starter_reels)
                        }
                      >
                        Programar Reels
                      </button>
                      <button
                        type="button"
                        className={button}
                        onClick={() => onStories(account.id, draft.product_url)}
                      >
                        Montar Stories
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
