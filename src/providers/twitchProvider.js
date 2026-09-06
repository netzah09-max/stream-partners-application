import { normalizeHandle } from "../utils.js";

export class TwitchProvider {
  constructor({ api }) {
    this.platform = "twitch";
    this.api = api;
  }

  async getLiveStatuses(streamers) {
    const handles = streamers.map((streamer) => normalizeHandle(streamer.handle));
    const streams = await this.api.getStreamsByLogin(handles);
    const liveByHandle = new Map(
      streams.map((stream) => [normalizeHandle(stream.user_login), normalizeTwitchStream(stream)])
    );

    return streamers.map((streamer) => {
      const handle = normalizeHandle(streamer.handle);
      const live = liveByHandle.get(handle);

      return {
        streamer,
        isLive: Boolean(live),
        live
      };
    });
  }
}

function normalizeTwitchStream(stream) {
  const handle = normalizeHandle(stream.user_login);
  const thumbnailUrl = stream.thumbnail_url
    ? stream.thumbnail_url.replace("{width}", "1280").replace("{height}", "720")
    : null;

  return {
    platform: "twitch",
    streamId: stream.id,
    handle,
    displayName: stream.user_name || handle,
    title: stream.title || "Untitled stream",
    category: stream.game_name || "No category",
    viewerCount: stream.viewer_count ?? null,
    startedAt: stream.started_at ?? null,
    thumbnailUrl,
    url: `https://www.twitch.tv/${handle}`
  };
}
