import { useEffect } from "react";
import { type AndroidSettings, type HotDevices } from "@/lib/hot-profiles";
import { hotButton, hotInput } from "./HotDialog";

export function AndroidSettingsFields({
  value,
  onChange,
  devices,
  existing,
}: {
  value: AndroidSettings;
  onChange: (value: AndroidSettings) => void;
  devices: HotDevices | null;
  existing: boolean;
}) {
  const images = devices?.runtime?.images || [];
  const image = images.find((image) => image.id === value.imageId) || images[0];
  const minimum = image?.minRamMb || 1536;
  useEffect(() => {
    if (value.ramMb < minimum) onChange({ ...value, ramMb: minimum });
  }, [minimum, value.ramMb]);
  const update = (next: Partial<AndroidSettings>) => onChange({ ...value, ...next });
  return (
    <fieldset className="space-y-4 rounded-xl border border-border p-4">
      <legend className="px-2 text-sm font-bold">Desempenho do celular</legend>
      <div className="flex flex-wrap gap-2">
        {(
          [
            {
              label: "Leve",
              ramMb: 1536,
              cpuCores: 2,
              resolution: "360x640",
              fps: 15,
              memoryMode: "low",
            },
            {
              label: "Equilibrado",
              ramMb: 2048,
              cpuCores: 2,
              resolution: "540x960",
              fps: 30,
              memoryMode: "normal",
            },
            {
              label: "Desempenho",
              ramMb: 4096,
              cpuCores: 4,
              resolution: "720x1280",
              fps: 60,
              memoryMode: "normal",
            },
          ] as const
        ).map(({ label, ...preset }) => (
          <button
            key={label}
            type="button"
            className={hotButton}
            onClick={() =>
              update({
                ...preset,
                ramMb: Math.max(minimum, preset.ramMb),
                cpuCores: Math.min(preset.cpuCores, devices?.performance?.cores || 8),
                graphics: "auto",
                animations: false,
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          RAM do Android
          <select
            aria-label="RAM do Android"
            className={hotInput}
            value={value.ramMb}
            onChange={(event) => update({ ramMb: Number(event.target.value) })}
          >
            {[1536, 2048, 3072, 4096, 6144, 8192].map((mb) => (
              <option key={mb} value={mb} disabled={mb < minimum}>
                {mb} MB{mb < minimum ? " · indisponível nesta imagem" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          Núcleos de CPU
          <select
            aria-label="Núcleos de CPU"
            className={hotInput}
            value={value.cpuCores}
            onChange={(event) => update({ cpuCores: Number(event.target.value) })}
          >
            {Array.from(
              { length: Math.min(8, devices?.performance?.cores || 8) },
              (_, n) => n + 1,
            ).map((n) => (
              <option key={n} value={n}>
                {n} núcleo{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          Resolução
          <select
            className={hotInput}
            value={value.resolution}
            onChange={(event) => update({ resolution: event.target.value })}
          >
            {["360x640", "540x960", "720x1280", "1080x1920"].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          Gráficos
          <select
            className={hotInput}
            value={value.graphics}
            onChange={(event) =>
              update({ graphics: event.target.value as AndroidSettings["graphics"] })
            }
          >
            <option value="auto">Automático · recomendado</option>
            <option value="host">GPU do computador</option>
            <option value="software">Software · compatibilidade</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          Memória
          <select
            className={hotInput}
            value={value.memoryMode}
            onChange={(event) =>
              update({ memoryMode: event.target.value as AndroidSettings["memoryMode"] })
            }
          >
            <option value="normal">Normal</option>
            <option value="low">Econômica · Android low RAM</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          Limite de atualização
          <select
            className={hotInput}
            value={value.fps}
            onChange={(event) =>
              update({ fps: Number(event.target.value) as AndroidSettings["fps"] })
            }
          >
            {[15, 30, 60].map((fps) => (
              <option key={fps} value={fps}>
                Até {fps} FPS
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-2 text-sm">
        Imagem Android
        <select
          disabled={existing}
          className={hotInput}
          value={value.imageId}
          onChange={(event) => update({ imageId: event.target.value })}
        >
          <option value="">Automática · preservar imagem do perfil</option>
          {images.map((image) => (
            <option key={image.id} value={image.id}>
              API {image.api} · {image.description}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.animations}
          onChange={(event) => update({ animations: event.target.checked })}
        />
        Animações do Android
      </label>
      <p className="text-xs leading-5 text-muted-foreground">
        Mudanças valem na próxima abertura. Mais RAM ou CPU pode piorar o desempenho se faltar
        recurso no Windows. O modo econômico reduz o uso de memória do Android; não altera a
        velocidade física da RAM. FPS é um limite, não uma garantia.
      </p>
      {minimum >= 4096 && (
        <p role="status" className="text-xs leading-5 text-amber-500">
          Esta imagem de páginas de 16 KB exige ao menos 4096 MB. Para criar celulares mais leves,
          instale uma imagem Android padrão no SDK e selecione-a em um novo perfil. A imagem de um
          celular existente é preservada.
        </p>
      )}
    </fieldset>
  );
}
