import { useCallback, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Globe, RefreshCw, Search, Settings2 } from "lucide-react";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { readMouseHotSettings } from "@/lib/mousehot-settings";
import "./dashboard-header.css";

const dashboardQueries = {
  home: [
    "sales-overview",
    "mousehot-postkit-workspace",
    "mousehot-postkit-queue",
    "mousehot-postkit-performance",
    "scalehot-meta-report",
  ],
  instagram: ["mousehot-instagram-dashboard"],
  scalehot: [
    "scalehot-operation",
    "scalehot-operation-sales",
    "scalehot-operation-comparison",
    "scalehot-operation-ads",
    "scalehot-meta-ads",
    "scalehot-google-ads",
  ],
};

export type DashboardHeaderKind = keyof typeof dashboardQueries;

const refreshTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const noTimestamp = () => 0;

export function DashboardHeader({
  kind,
  onSearch,
}: {
  kind: DashboardHeaderKind;
  onSearch: () => void;
}) {
  const { user } = usePlatformAccess();
  const client = useQueryClient();
  const cache = client.getQueryCache();
  const roots = dashboardQueries[kind];
  const matches = (query: { queryKey: readonly unknown[] }) =>
    typeof query.queryKey[0] === "string" && roots.includes(query.queryKey[0]);
  const filters = { type: "active" as const, predicate: matches };
  const subscribe = useCallback((listener: () => void) => cache.subscribe(listener), [cache]);
  const updatedAt = useSyncExternalStore(
    subscribe,
    () =>
      cache
        .findAll(filters)
        .reduce((latest, query) => Math.max(latest, query.state.dataUpdatedAt), 0),
    noTimestamp,
  );
  const hasQueries = useSyncExternalStore(
    subscribe,
    () => cache.findAll(filters).length > 0,
    () => false,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function refresh() {
    setRefreshing(true);
    setFeedback("");
    try {
      await client.refetchQueries(filters, { cancelRefetch: false });
      const results = cache.findAll(filters);
      if (results.some(({ state }) => state.fetchStatus === "paused")) {
        setFeedback("Sem conexão. Tente novamente quando estiver online.");
      } else if (
        results.some(
          ({ state }) =>
            state.status === "error" ||
            (state.data as { incomplete?: boolean } | undefined)?.incomplete,
        )
      ) {
        setFeedback("Alguns dados não puderam ser atualizados.");
      }
    } catch {
      setFeedback("Não foi possível atualizar os dados. Tente novamente.");
    } finally {
      setRefreshing(false);
    }
  }

  const metadata = user?.user_metadata;
  const profileName = [metadata?.given_name, metadata?.full_name, metadata?.name].find(
    (value): value is string => typeof value === "string" && Boolean(value.trim()),
  );
  const name = readMouseHotSettings(metadata).displayName || profileName?.trim() || "Minha conta";

  return (
    <>
      <div className="dashboard-header-status">
        {updatedAt ? (
          <span>
            Atualizado{" "}
            <time dateTime={new Date(updatedAt).toISOString()} title="Horário de Brasília">
              {refreshTime.format(updatedAt)}
            </time>
          </span>
        ) : (
          <span>Última atualização —</span>
        )}
        {feedback && (
          <span className="dashboard-header-feedback" role="status">
            {feedback}
          </span>
        )}
      </div>
      <div className="dashboard-header-actions">
        <button
          type="button"
          className="dashboard-header-control"
          disabled={refreshing || !hasQueries}
          aria-label="Atualizar dados do painel"
          aria-busy={refreshing}
          onClick={() => void refresh()}
        >
          <RefreshCw
            className={refreshing ? "dashboard-header-spinner" : undefined}
            size={17}
            aria-hidden
          />
          <span className="dashboard-refresh-label">
            {refreshing ? "Atualizando…" : "Atualizar"}
          </span>
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="dashboard-header-control"
              type="button"
              aria-label="Idioma da interface: Português do Brasil"
            >
              <Globe size={17} aria-hidden />
              <span>PT</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-max max-w-xs text-sm">
            <strong>Idioma da interface</strong>
            <p className="mt-1 text-muted-foreground">Português (Brasil)</p>
          </PopoverContent>
        </Popover>
        <Link
          to="/vendas/notificacoes"
          className="dashboard-header-control dashboard-header-bell"
          aria-label="Notificações"
        >
          <Bell size={18} aria-hidden />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="dashboard-header-control dashboard-header-account"
              type="button"
              aria-label={`Menu da conta: ${name}`}
            >
              <span className="dashboard-header-avatar" aria-hidden>
                {[...name][0]?.toLocaleUpperCase("pt-BR")}
              </span>
              <span className="dashboard-header-name">{name}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem asChild>
              <Link to="/configuracoes">
                <Settings2 aria-hidden /> Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onSearch}>
              <Search aria-hidden /> Buscar ferramenta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
