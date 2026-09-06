import { getPlatformName } from "../services/channelLinks.js";
import { normalizeHandle } from "../utils.js";

export class YouTubeProvider {
  constructor({ apiKey, fetchImpl = fetch }) {
    if (!apiKey) {
      throw new Error("YOUTUBE_API_KEY is required for YouTube live checks.");
    }

    this.platform = "youtube";
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.channelIdCache = new Map();
  }

  async getLiveStatuses(streamers) {
    const statuses = [];

    for (const streamer of streamers) {
      const channelId = await this.resolveChannelId(streamer);
      if (!channelId) {
        statuses.push({ streamer, isLive: false, live: null });
        continue;
      }

      const live = await this.getLiveStreamForChannel({ streamer, channelId });
      statuses.push({ streamer, isLive: Boolean(live), live });
    }

    return statuses;
  }

  async resolveChannelId(streamer) {
    if (streamer.metadata?.youtubeChannelId) {
      return streamer.metadata.youtubeChannelId;
    }

    const handle = streamer.metadata?.youtubeHandle || `@${normalizeHandle(streamer.handle)}`;
    const cacheKey = handle.toLowerCase();
    if (this.channelIdCache.has(cacheKey)) {
      return this.channelIdCache.get(cacheKey);
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "id,snippet");
    url.searchParams.set("forHandle", handle);
    url.searchParams.set("key", this.apiKey);

    const response = await this.fetchJson(url);
    const channelId = response.items?.[0]?.id ?? null;
    this.channelIdCache.set(cacheKey, channelId);
    return channelId;
  }

  async getLiveStreamForChannel({ streamer, channelId }) {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("channelId", channelId);
    url.searchParams.set("eventType", "live");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("key", this.apiKey);

    const response = await this.fetchJson(url);
    const item = response.items?.[0];
    if (!item?.id?.videoId) {
      return null;
    }

    const videoId = item.id.videoId;
    return {
      platform: "youtube",
      streamId: videoId,
      handle: normalizeHandle(streamer.handle),
      displayName: item.snippet?.channelTitle || streamer.displayName || getPlatformName("youtube"),
      title: item.snippet?.title || "Live on YouTube",
      category: "YouTube Live",
      viewerCount: null,
      startedAt: item.snippet?.publishedAt ?? null,
      thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
      url: `https://www.youtube.com/watch?v=${videoId}`
    };
  }

  async fetchJson(url) {
    const response = await this.fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`YouTube request failed (${response.status}): ${text}`);
    }

    return response.json();
  }
}

function bestThumbnail(thumbnails = {}) {
  return (
    thumbnails.maxres?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    null
  );
}
