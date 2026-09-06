import { normalizeHandle } from "../utils.js";

export class TikTokProvider {
  constructor({ liveCheckUrl, apiKey = null, fetchImpl = fetch }) {
    if (!liveCheckUrl) {
      throw new Error("TIKTOK_LIVE_CHECK_URL is required for TikTok live checks.");
    }

    this.platform = "tiktok";
    this.liveCheckUrl = liveCheckUrl;
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
  }

  async getLiveStatuses(streamers) {
    const statuses = [];

    for (const streamer of streamers) {
      const handle = normalizeHandle(streamer.handle);
      const url = new URL(this.liveCheckUrl);
      url.searchParams.set("handle", handle);

      const headers = { Accept: "application/json" };
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const response = await this.fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`TikTok live-check request failed (${response.status}) for ${handle}`);
      }

      const json = await response.json();
      const isLive = Boolean(json.isLive ?? json.is_live ?? json.live);
      statuses.push({
        streamer,
        isLive,
        live: isLive ? normalizeTikTokStream({ json, streamer, handle }) : null
      });
    }

    return statuses;
  }
}

function normalizeTikTokStream({ json, streamer, handle }) {
  const streamId = json.streamId ?? json.stream_id ?? json.roomId ?? json.room_id ?? `${handle}:live`;

  return {
    platform: "tiktok",
    streamId: String(streamId),
    handle,
    displayName: json.displayName ?? json.display_name ?? streamer.displayName ?? handle,
    title: json.title ?? "Live on TikTok",
    category: "TikTok Live",
    viewerCount: json.viewerCount ?? json.viewer_count ?? null,
    startedAt: json.startedAt ?? json.started_at ?? null,
    thumbnailUrl: json.thumbnailUrl ?? json.thumbnail_url ?? null,
    url: json.url ?? `https://www.tiktok.com/@${handle}/live`
  };
}
