// Configuration is a hint, never evidence that a device is online.
export const localSerial = (serial) => {
  const tcp = /^127\.0\.0\.1:(\d+)$/.exec(serial || "");
  const emulator = /^emulator-(\d+)$/.exec(serial || "");
  const port = tcp ? Number(tcp[1]) : emulator ? Number(emulator[1]) + 1 : 0;
  return Number.isInteger(port) && port > 1 && port <= 65535 ? `127.0.0.1:${port}` : null;
};
const validPort = (value) =>
  /^\d+$/.test(value || "") && Number(value) > 1 && Number(value) <= 65535;

export function parseBlueStacks(content) {
  // Deliberately retain only connection fields. Never return the full config.
  const entries = Object.fromEntries(
    [...content.matchAll(/^([^=\r\n]+)="([^"\r\n]*)"/gm)]
      .filter(([, key]) =>
        /^bst\.(enable_adb_(?:remote_)?access|instance\.[A-Za-z0-9_]+\.(?:display_name|adb_port|status\.adb_port))$/.test(
          key,
        ),
      )
      .map(([, key, value]) => [key, value]),
  );
  const names = [
    ...new Set(
      Object.keys(entries).flatMap(
        (key) => key.match(/^bst\.instance\.([A-Za-z0-9_]+)\./)?.[1] || [],
      ),
    ),
  ];
  return {
    readable: true,
    enabled: entries["bst.enable_adb_access"] === "1",
    remoteEnabled: entries["bst.enable_adb_remote_access"] === "1",
    instances: names.map((instance) => {
      const prefix = `bst.instance.${instance}.`;
      return {
        id: `bluestacks:${instance}`,
        instance,
        name: entries[prefix + "display_name"] || instance,
        port: validPort(entries[prefix + "adb_port"]) ? Number(entries[prefix + "adb_port"]) : null,
        statusPort: validPort(entries[prefix + "status.adb_port"])
          ? Number(entries[prefix + "status.adb_port"])
          : null,
      };
    }),
  };
}

export function endpointCandidates(configuration, instance) {
  return [...new Set([instance.port, instance.statusPort].filter(Boolean))].filter(
    (port) =>
      !configuration.instances.some(
        (other) =>
          other.id !== instance.id &&
          (other.port === port || (port !== instance.port && other.statusPort === port)),
      ),
  );
}

export function androidDevices(configuration, output) {
  const connected = output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => state === "device" && localSerial(serial))
    .map(([serial]) => serial);
  const claimed = new Set();
  const devices = configuration.instances.map((instance) => {
    const candidates = endpointCandidates(configuration, instance);
    // Multiple responding candidates cannot establish which is this instance.
    const matches = [
      ...new Set(
        connected
          .map(localSerial)
          .filter((serial) => candidates.some((port) => serial === `127.0.0.1:${port}`)),
      ),
    ];
    const serial = configuration.enabled && matches.length === 1 ? matches[0] : null;
    if (serial) claimed.add(serial);
    const warnings = [];
    if (!configuration.enabled)
      warnings.push("ADB desativado. Ative em Configurações → Avançado no BlueStacks.");
    if (!instance.port)
      warnings.push("Porta ADB ausente ou inválida; não será usada uma porta padrão.");
    if (instance.statusPort && instance.statusPort !== instance.port)
      warnings.push(
        "Portas de configuração e de status divergem. Somente uma resposta ADB confirma conexão.",
      );
    if (!candidates.length || matches.length > 1)
      warnings.push(
        "Endpoint ambíguo. Confira a porta mostrada nas opções avançadas do BlueStacks.",
      );
    return {
      ...instance,
      provider: "bluestacks",
      serial: connected.find((raw) => localSerial(raw) === serial) || null,
      endpoint: serial,
      candidateEndpoints: candidates.map((port) => `127.0.0.1:${port}`),
      ready: !!serial,
      adbEnabled: configuration.enabled,
      warnings,
    };
  });
  for (const raw of connected) {
    const serial = localSerial(raw);
    // Never offer an ambiguous BlueStacks port as an independent generic device.
    const known = configuration.instances.some((i) =>
      [i.port, i.statusPort].some((p) => serial === `127.0.0.1:${p}`),
    );
    if (!claimed.has(serial) && !known) {
      claimed.add(serial);
      devices.push({
        id: `adb:${serial}`,
        name: `Android ${serial}`,
        serial: raw,
        endpoint: serial,
        candidateEndpoints: [serial],
        provider: "adb",
        ready: true,
        adbEnabled: true,
        warnings: [],
      });
    }
  }
  return devices;
}
