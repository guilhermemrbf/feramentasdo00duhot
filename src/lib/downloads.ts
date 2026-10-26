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
    version: "0.5.2",
    ...packageDownload("telegram-sync-desktop-15-1", "TelegramSync-Windows.zip"),
  },
  hotProfiles: packageDownload("hot-profiles-local-2-1", "hot-profiles-connector.zip"),
  hotProfilesDesktop: {
    version: "0.3.0",
    ...packageDownload("hot-profiles-desktop-4-1", "HotProfiles-0.3.0-x64.exe"),
    portable: `${releases}/download/hot-profiles-desktop-4-1/HotProfiles-0.3.0-x64.zip`,
  },
} as const;
