export const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
export const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

export const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export const ACCEPTED_MEDIA_TYPES = [
  ...ACCEPTED_IMAGE_TYPES,
  ...ACCEPTED_VIDEO_TYPES,
];

/**
 * Faz upload de uma imagem ou vídeo para o Cloudinary (preset unsigned)
 * e devolve a URL pública.
 */
export function uploadToCloudinary(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
      reject(new Error("Formato inválido."));
      return;
    }

    if (!CLOUD_NAME || !UPLOAD_PRESET || CLOUD_NAME === "your_cloud_name") {
      reject(new Error("Erro de configuração (.env)."));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const resourceType = file.type.startsWith("video/") ? "video" : "image";
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      \`https://api.cloudinary.com/v1_1/\${CLOUD_NAME}/\${resourceType}/upload\`,
    );

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) {
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
