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

    for (const resolver of getChannelResolvers(streamer)) {
      const cacheKey = `${resolver.type}:${resolver.value}`.toLowerCase();
      if (this.channelIdCache.has(cacheKey)) {
        const cached = this.channelIdCache.get(cacheKey);
        if (cached) {
          return cached;
        }

        continue;
      }

      const channelId = await this.fetchChannelId(resolver);
      this.channelIdCache.set(cacheKey, channelId);
      if (channelId) {
        return channelId;
      }
    }

    return null;
  }

  async fetchChannelId(resolver) {
    if (resolver.type === "customPath") {
      return this.searchChannelId(resolver.value);
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "id,snippet");
    url.searchParams.set(resolver.type === "username" ? "forUsername" : "forHandle", resolver.value);
    url.searchParams.set("key", this.apiKey);

    const response = await this.fetchJson(url);
    return response.items?.[0]?.id ?? null;
  }

  async searchChannelId(query) {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "channel");
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("key", this.apiKey);

    const response = await this.fetchJson(url);
    const item = response.items?.[0];
    return item?.id?.channelId ?? item?.snippet?.channelId ?? null;
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

function getChannelResolvers(streamer) {
  const metadata = streamer.metadata ?? {};
  const resolvers = [];
  const legacyPath = parseLegacyPath(metadata.youtubeLegacyPath);

  if (metadata.youtubeHandle) {
    resolvers.push({ type: "handle", value: ensureHandle(metadata.youtubeHandle) });
  }

  if (legacyPath?.type === "user") {
    resolvers.push({ type: "username", value: legacyPath.value });
  }

  const normalizedHandle = normalizeHandle(streamer.handle);
  if (normalizedHandle) {
    resolvers.push({ type: "handle", value: ensureHandle(normalizedHandle) });
  }

  if (legacyPath?.type === "c") {
    resolvers.push({ type: "customPath", value: legacyPath.value });
  }

  return uniqueResolvers(resolvers);
}

function parseLegacyPath(value) {
  const [type, ...rest] = String(value ?? "").split("/");
  const cleanType = type?.toLowerCase();
  const cleanValue = rest.join("/").trim();

  if (!["c", "user"].includes(cleanType) || !cleanValue) {
    return null;
  }

  return {
    type: cleanType,
    value: cleanValue
  };
}

function ensureHandle(value) {
  const handle = String(value ?? "").trim();
  return handle.startsWith("@") ? handle : `@${handle}`;
}

function uniqueResolvers(resolvers) {
  const seen = new Set();
  return resolvers.filter((resolver) => {
    const key = `${resolver.type}:${resolver.value}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
