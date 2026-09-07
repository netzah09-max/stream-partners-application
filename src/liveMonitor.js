import { makeStreamerKey, normalizeHandle } from "./utils.js";

export class LiveMonitor {
  constructor({ store, providers, notifier, pollIntervalMs, logger = console }) {
    this.store = store;
    this.providers = providers;
    this.notifier = notifier;
    this.pollIntervalMs = pollIntervalMs;
    this.logger = logger;
    this.interval = null;
    this.isTicking = false;
    this.missingProviderWarnings = new Set();
  }

  async start() {
    await this.tick();
    this.interval = setInterval(() => {
      this.tick().catch((error) => {
        this.logger.error("Live monitor tick failed:", error);
      });
    }, this.pollIntervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async tick() {
    if (this.isTicking) {
      this.logger.warn("Previous monitor tick is still running; skipping this tick.");
      return;
    }

    this.isTicking = true;

    try {
      await this.checkStreamers();
    } finally {
      this.isTicking = false;
    }
  }

  async checkStreamers() {
    const watchlist = await this.store.getWatchlist();
    const state = await this.store.getState();
    const enabledStreamers = watchlist.streamers.filter((streamer) => streamer.enabled);

    if (enabledStreamers.length === 0) {
      this.logger.log("No enabled streamers in the watchlist yet.");
      return;
    }

    const streamersByPlatform = groupByPlatform(enabledStreamers);

    for (const [platform, streamers] of streamersByPlatform.entries()) {
      const provider = this.providers[platform];

      if (!provider) {
        if (!this.missingProviderWarnings.has(platform)) {
          this.logger.warn(
            `No provider for ${platform} is configured; ${streamers.length} streamer(s) skipped.`
          );
          this.missingProviderWarnings.add(platform);
        }
        continue;
      }

      try {
        await this.checkPlatform({ provider, streamers, state });
      } catch (error) {
        this.logger.error(`Live provider check failed for ${platform}:`, error);
      }
    }

    await this.store.saveState(state);
  }

  async checkPlatform({ provider, streamers, state }) {
    const statuses = await provider.getLiveStatuses(streamers);

    for (const status of statuses) {
      await this.handleStatus({ status, state });
    }
  }

  async handleStatus({ status, state }) {
    const { streamer, isLive, live } = status;
    const key = makeStreamerKey(streamer.platform, streamer.handle);
    const current = state.streams[key] ?? {
      platform: streamer.platform,
      handle: normalizeHandle(streamer.handle),
      isLive: false,
      lastStreamId: null,
      lastNotifiedStreamId: null,
      lastSeenLiveAt: null,
      lastSeenOfflineAt: null
    };

    if (!isLive) {
      if (current.isLive) {
        this.logger.log(`${streamer.platform}:${streamer.handle} is offline now.`);
      }

      state.streams[key] = {
        ...current,
        isLive: false,
        lastSeenOfflineAt: new Date().toISOString()
      };
      return;
    }

    const alreadyNotified = current.lastNotifiedStreamId === live.streamId;

    state.streams[key] = {
      ...current,
      platform: live.platform,
      handle: live.handle,
      isLive: true,
      lastStreamId: live.streamId,
      lastSeenLiveAt: new Date().toISOString()
    };

    if (alreadyNotified) {
      return;
    }

    await this.notifier.sendLiveNotification({ streamer, live });
    state.streams[key].lastNotifiedStreamId = live.streamId;
    state.streams[key].lastNotifiedAt = new Date().toISOString();
    this.logger.log(`Sent live notification for ${live.platform}:${live.handle}.`);
  }
}

function groupByPlatform(streamers) {
  const groups = new Map();

  for (const streamer of streamers) {
    const existing = groups.get(streamer.platform) ?? [];
    existing.push(streamer);
    groups.set(streamer.platform, existing);
  }

  return groups;
}
