// Pin verified packages: unrelated tool releases must not change a download.
const releases = "https://github.com/guilhermemrbf/feramentasdo00duhot/releases";

function packageDownload(tag: string, filename: string) {
  return {
    url: `${releases}/download/${tag}/${filename}`,
    release: `${releases}/tag/${tag}`,
  };
}

export const downloads = {
  fazendaDeCelulares: {
    version: "0.6.0",
    ...packageDownload(
      "fazenda-de-celulares-v0.6.0",
      "Fazenda-de-Celulares-0.6.0-Setup-Windows-x64.exe",
    ),
  },
  mouseHotDownloader: {
    version: "3.0.8",
    url: "/downloads/Mousefy-Downloader-3.0.8.zip",
  },
  telegramSync: {
    version: "0.7.1",
    ...packageDownload("telegram-sync-desktop-18-1", "TelegramSync-Windows.zip"),
  },
  hotProfiles: {
    url: "/hot-profiles-connector.zip",
    integrity: "/hot-profiles-SHA256SUMS.txt",
  },
  hotProfilesDesktop: {
    version: "0.3.1",
    ...packageDownload("hot-profiles-desktop-5-1", "HotProfiles-0.3.1-x64.exe"),
    portable: `${releases}/download/hot-profiles-desktop-5-1/HotProfiles-0.3.1-x64.zip`,
  },
} as const;
