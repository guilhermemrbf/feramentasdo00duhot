const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};

export const ANDROID_DEFAULTS = Object.freeze({
  ramMb: 2048,
  cpuCores: 2,
  resolution: "540x960",
  graphics: "auto",
  memoryMode: "normal",
  fps: 30,
  animations: false,
  imageId: "",
});
export const ANDROID_RESOLUTIONS = Object.freeze({
  "360x640": 160,
  "540x960": 240,
  "720x1280": 320,
  "1080x1920": 480,
});
export function androidSettings(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("Configurações Android inválidas.");
  const value = { ...ANDROID_DEFAULTS, ...input };
  if (
    !Number.isInteger(value.ramMb) ||
    value.ramMb < 1536 ||
    value.ramMb > 8192 ||
    value.ramMb % 256 !== 0
  )
    fail("RAM Android deve ficar entre 1536 e 8192 MB, em passos de 256 MB.");
  if (!Number.isInteger(value.cpuCores) || value.cpuCores < 1 || value.cpuCores > 8)
    fail("Escolha de 1 a 8 núcleos de CPU.");
  if (
    !Object.hasOwn(ANDROID_RESOLUTIONS, value.resolution) ||
    !["auto", "host", "software"].includes(value.graphics) ||
    !["normal", "low"].includes(value.memoryMode) ||
    ![15, 30, 60].includes(value.fps) ||
    typeof value.animations !== "boolean"
  )
    fail("Confira resolução, gráficos, memória, FPS e animações.");
  if (
    typeof value.imageId !== "string" ||
    value.imageId.length > 150 ||
    (value.imageId && !/^android-[\w.]+\/[\w.-]+\/x86_64$/.test(value.imageId))
  )
    fail("Imagem Android inválida.");
  return Object.fromEntries(Object.keys(ANDROID_DEFAULTS).map((key) => [key, value[key]]));
}

export function updateRuntimeConfig(content, settings, image) {
  const [width, height] = settings.resolution.split("x");
  const values = {
    "hw.cpu.ncore": settings.cpuCores,
    "hw.ramSize": Math.max(settings.ramMb, image.minRamMb || 1536),
    "hw.lcd.width": width,
    "hw.lcd.height": height,
    "hw.lcd.density": ANDROID_RESOLUTIONS[settings.resolution],
    "hw.gpu.mode": settings.graphics === "software" ? "swiftshader" : settings.graphics,
  };
  let result = content;
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key.replaceAll(".", "\\.")}\\s*=.*$`, "m");
    result = pattern.test(result)
      ? result.replace(pattern, `${key}=${value}`)
      : `${result}\n${key}=${value}\n`;
  }
  return result;
}
