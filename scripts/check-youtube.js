import "dotenv/config";
import { readDataConfig, readOptionalProviderConfig } from "../src/config.js";
import { YouTubeProvider } from "../src/providers/youtubeProvider.js";
import { JsonFileStore } from "../src/storage/jsonStore.js";

const { youtube } = readOptionalProviderConfig();

if (!youtube.apiKey) {
  console.error("YOUTUBE_API_KEY is missing from .env.");
  console.error("Create a Google Cloud API key with YouTube Data API v3 enabled, then add:");
  console.error("YOUTUBE_API_KEY=your_key_here");
  process.exit(1);
}

const store = new JsonFileStore({ dataDir: readDataConfig().dataDir });
const streamers = (await store.listStreamers({ includeDisabled: false })).filter(
  (streamer) => streamer.platform === "youtube"
);

if (streamers.length === 0) {
  console.log("No enabled YouTube streamers are in the watchlist yet.");
  process.exit(0);
}

const provider = new YouTubeProvider({ apiKey: youtube.apiKey });

for (const streamer of streamers) {
  try {
    const channelId = await provider.resolveChannelId(streamer);
    if (!channelId) {
      console.log(`OFFLINE/UNKNOWN ${streamer.displayName}: could not resolve YouTube channel ID.`);
      continue;
    }

    const [status] = await provider.getLiveStatuses([streamer]);
    if (!status.isLive) {
      console.log(`OFFLINE ${streamer.displayName}: channel ${channelId}`);
      continue;
    }

    console.log(`LIVE ${status.live.displayName}: ${status.live.url}`);
  } catch (error) {
    console.error(`FAIL ${streamer.displayName || streamer.handle}: ${error.message}`);
    process.exitCode = 1;
  }
}
