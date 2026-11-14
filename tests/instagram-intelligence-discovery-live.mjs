import { discoverInstagramProfile } from "../src/lib/instagram-intelligence-discovery.server.ts";
import { parseInstagramProfiles } from "../src/lib/instagram-intelligence-import.ts";

const parsed = parseInstagramProfiles(process.argv.slice(2).join(" "));
if (parsed.error || parsed.invalidLines.length || parsed.usernames.length !== 1) {
  console.error("Informe um único @ ou link do Instagram.");
  process.exit(2);
}
const { META_GRAPH_API_VERSION, INSTAGRAM_DISCOVERY_ACCOUNT_ID, INSTAGRAM_DISCOVERY_ACCESS_TOKEN } =
  process.env;
if (!META_GRAPH_API_VERSION || !INSTAGRAM_DISCOVERY_ACCOUNT_ID || !INSTAGRAM_DISCOVERY_ACCESS_TOKEN) {
  console.error("Configuração de Business Discovery ausente. Consulte docs/instagram-intelligence.md.");
  process.exit(2);
}

try {
  const result = await discoverInstagramProfile({
    version: META_GRAPH_API_VERSION,
    accountId: INSTAGRAM_DISCOVERY_ACCOUNT_ID,
    token: INSTAGRAM_DISCOVERY_ACCESS_TOKEN,
    username: parsed.usernames[0],
  });
  const summary =
    result.status === "available"
      ? {
          status: result.status,
          reels: result.reels.length,
          reelsComViews: result.reels.filter((reel) => reel.views !== null).length,
          reelsComVideo: result.reels.filter((reel) => reel.videoUrl !== null).length,
          amostraLimitada: result.truncated,
        }
      : { status: result.status };
  console.log(JSON.stringify(summary));
  if (result.status !== "available") process.exitCode = 1;
} catch {
  console.error("A configuração de Business Discovery é inválida.");
  process.exitCode = 2;
}
