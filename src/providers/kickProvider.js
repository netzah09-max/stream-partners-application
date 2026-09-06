import { normalizeHandle } from "../utils.js";

export class KickProvider {
  constructor({ fetchImpl = fetch }) {
    this.platform = "kick";
    this.fetch = fetchImpl;
  }

  async getLiveStatuses(streamers) {
    const statuses = [];

    for (const streamer of streamers) {
      const handle = normalizeHandle(streamer.handle);
      const response = await this.fetch(
        `https://kick.com/api/v2/channels/${encodeURIComponent(handle)}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "discord-live-bot/0.1"
          }
        }
      );

      if (response.status === 404) {
        statuses.push({ streamer, isLive: false, live: null });
        continue;
      }

      if (!response.ok) {
        throw new Error(`Kick request failed (${response.status}) for ${handle}`);
      }

      const channel = await response.json();
      const livestream = channel.livestream;
      statuses.push({
        streamer,
        isLive: Boolean(livestream?.is_live),
        live: livestream?.is_live ? normalizeKickStream({ channel, livestream, handle }) : null
      });
    }

    return statuses;
  }
}

function normalizeKickStream({ channel, livestream, handle }) {
  const category = livestream.categories?.[0]?.name || livestream.category?.name || "No category";

  return {
    platform: "kick",
    streamId: String(livestream.id),
    handle,
    displayName: channel.user?.username || channel.slug || handle,
    title: livestream.session_title || "Untitled stream",
    category,
    viewerCount: livestream.viewer_count ?? null,
    startedAt: parseKickStartTime(livestream.start_time),
    thumbnailUrl: livestream.thumbnail || null,
    url: `https://kick.com/${handle}`
  };
}

function parseKickStartTime(value) {
  if (!value) {
    return null;
  }

  const direct = new Date(value);
  if (!Number.isNaN(direct.valueOf())) {
    return direct.toISOString();
  }

  const assumedUtc = new Date(`${value} UTC`);
  return Number.isNaN(assumedUtc.valueOf()) ? null : assumedUtc.toISOString();
}
