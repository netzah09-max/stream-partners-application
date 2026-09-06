import { readDataConfig, readTwitchConfig } from "../src/config.js";
import { JsonFileStore } from "../src/storage/jsonStore.js";
import { TwitchApi } from "../src/services/twitchApi.js";
import { TwitchProvider } from "../src/providers/twitchProvider.js";

async function main() {
  const store = new JsonFileStore(readDataConfig());
  const streamers = (await store.listStreamers({ includeDisabled: false })).filter(
    (streamer) => streamer.platform === "twitch"
  );

  if (streamers.length === 0) {
    console.log("No enabled Twitch streamers in data/watchlist.json.");
    return;
  }

  const api = new TwitchApi(readTwitchConfig());
  const provider = new TwitchProvider({ api });
  const statuses = await provider.getLiveStatuses(streamers);

  for (const status of statuses) {
    if (status.isLive) {
      console.log(
        `LIVE  ${status.live.displayName} - ${status.live.title} (${status.live.url})`
      );
    } else {
      console.log(`OFF   ${status.streamer.displayName} (${status.streamer.handle})`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
