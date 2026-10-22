export const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
export const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export const ACCEPTED_MEDIA_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

/**
 * Faz upload de uma imagem ou vídeo para o Cloudinary (preset unsigned)
 * e devolve a URL pública.
 */
export function uploadToCloudinary(
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Envio cancelado.", "AbortError"));
      return;
    }
    if (!file.size) {
      reject(new Error("O arquivo está vazio."));
      return;
    }
    if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
      reject(new Error("Formato inválido."));
      return;
    }

    if (!CLOUD_NAME || !UPLOAD_PRESET || CLOUD_NAME === "your_cloud_name") {
      reject(
        new Error(
          "A hospedagem de arquivos ainda não foi configurada. Confira o Cloudinary nas configurações do projeto.",
        ),
      );
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const resourceType = file.type.startsWith("video/") ? "video" : "image";
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`);

    xhr.timeout = 120000;
    const abort = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener("abort", abort);
    signal?.addEventListener("abort", abort, { once: true });
    xhr.onloadend = cleanup;
    xhr.onabort = () => reject(new DOMException("Envio cancelado.", "AbortError"));
    xhr.ontimeout = () =>
      reject(new Error("O envio demorou demais. Verifique sua conexão antes de enviar novamente."));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (
          xhr.status >= 200 &&
          xhr.status < 300 &&
          typeof res.secure_url === "string" &&
          new URL(res.secure_url).protocol === "https:"
        ) {
          onProgress?.(100);
          resolve(res.secure_url as string);
        } else {
          reject(new Error(res.error?.message || "Erro no upload."));
        }
      } catch {
        reject(new Error("Erro na resposta."));
      }
    };

    xhr.onerror = () => reject(new Error("Erro de rede."));
    xhr.send(formData);
  });
}
