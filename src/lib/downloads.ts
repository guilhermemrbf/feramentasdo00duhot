// Pin verified packages: unrelated tool releases must not change a download.
const releases = "https://github.com/guilhermemrbf/feramentasdo00duhot/releases";

function packageDownload(tag: string, filename: string) {
  return {
    url: `${releases}/download/${tag}/${filename}`,
    release: `${releases}/tag/${tag}`,
  };
}

export const downloads = {
  telegramSync: {
    version: "0.7.1",
    ...packageDownload("telegram-sync-desktop-18-1", "TelegramSync-Windows.zip"),
  },
  socialMediaExtension: {
    version: "0.1.0",
    url: "/downloads/00-do-hot-media-downloader-v0.1.0.zip",
    filename: "00-do-hot-media-downloader-v0.1.0.zip",
    source: "https://github.com/guilhermemrbf/feramentasdo00duhot/tree/feat/social-media-downloader-extension/apps/social-media-downloader-extension",
  },
  hotProfiles: packageDownload("hot-profiles-local-6-1", "hot-profiles-connector.zip"),
  hotProfilesDesktop: {
    version: "0.3.1",
    ...packageDownload("hot-profiles-desktop-5-1", "HotProfiles-0.3.1-x64.exe"),
    portable: `${releases}/download/hot-profiles-desktop-5-1/HotProfiles-0.3.1-x64.zip`,
  },
} as const;
