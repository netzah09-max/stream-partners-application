import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  makeStreamerKey,
  normalizeHandle,
  normalizePlatform,
  supportedPlatforms
} from "../utils.js";

const watchlistDefaults = {
  version: 1,
  streamers: []
};

const stateDefaults = {
  version: 1,
  streams: {}
};

const applicationsDefaults = {
  version: 1,
  applications: []
};

export class JsonFileStore {
  constructor({ dataDir }) {
    this.dataDir = dataDir;
    this.watchlistPath = path.join(dataDir, "watchlist.json");
    this.statePath = path.join(dataDir, "live-state.json");
    this.applicationsPath = path.join(dataDir, "applications.json");
  }

  async ensureDataDir() {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  async readJson(filePath, defaults) {
    await this.ensureDataDir();

    try {
      const raw = await fs.readFile(filePath, "utf8");
      return { ...defaults, ...JSON.parse(raw) };
    } catch (error) {
      if (error.code === "ENOENT") {
        return structuredClone(defaults);
      }
      if (error instanceof SyntaxError) {
        return recoverJsonWithTrailingData({ filePath, defaults, error });
      }
      throw error;
    }
  }

  async writeJson(filePath, value) {
    await this.ensureDataDir();
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, filePath);
  }

  async getWatchlist() {
    const watchlist = await this.readJson(this.watchlistPath, watchlistDefaults);
    const streamers = Array.isArray(watchlist.streamers) ? watchlist.streamers : [];

    return {
      version: 1,
      streamers: streamers.map((streamer) => normalizeStreamerRecord(streamer))
    };
  }

  async saveWatchlist(watchlist) {
    await this.writeJson(this.watchlistPath, {
      version: 1,
      streamers: watchlist.streamers.map((streamer) => normalizeStreamerRecord(streamer))
    });
  }

  async getState() {
    const state = await this.readJson(this.statePath, stateDefaults);
    return {
      version: 1,
      streams: state.streams && typeof state.streams === "object" ? state.streams : {}
    };
  }

  async saveState(state) {
    await this.writeJson(this.statePath, {
      version: 1,
      streams: state.streams ?? {}
    });
  }

  async getApplications() {
    const applications = await this.readJson(this.applicationsPath, applicationsDefaults);
    const records = Array.isArray(applications.applications) ? applications.applications : [];

    return {
      version: 1,
      applications: records.map((application) => normalizeApplicationRecord(application))
    };
  }

  async saveApplications(applications) {
    await this.writeJson(this.applicationsPath, {
      version: 1,
      applications: applications.applications.map((application) =>
        normalizeApplicationRecord(application)
      )
    });
  }

  async createApplication({ type = "streamPartner", answers, channel = null }) {
    const applications = await this.getApplications();
    const now = new Date().toISOString();
    const application = normalizeApplicationRecord({
      id: randomUUID(),
      type,
      status: "pending",
      answers,
      channel,
      createdAt: now,
      updatedAt: now
    });

    applications.applications.unshift(application);
    await this.saveApplications(applications);
    return application;
  }

  async getApplication(id) {
    const applications = await this.getApplications();
    return applications.applications.find((application) => application.id === id) ?? null;
  }

  async updateApplication(id, updater) {
    const applications = await this.getApplications();
    const index = applications.applications.findIndex((application) => application.id === id);

    if (index === -1) {
      return null;
    }

    const updated = normalizeApplicationRecord({
      ...applications.applications[index],
      ...updater(applications.applications[index]),
      updatedAt: new Date().toISOString()
    });
    applications.applications[index] = updated;
    await this.saveApplications(applications);
    return updated;
  }

  async linkApplicationReviewMessage(id, reviewMessage) {
    return this.updateApplication(id, () => ({ reviewMessage }));
  }

  async updateApplicationStatus(id, { status, reviewedBy, reviewNote = null }) {
    return this.updateApplication(id, () => ({
      status,
      reviewedBy,
      reviewNote,
      reviewedAt: new Date().toISOString()
    }));
  }

  async listStreamers({ includeDisabled = true } = {}) {
    const watchlist = await this.getWatchlist();
    return watchlist.streamers.filter((streamer) => includeDisabled || streamer.enabled);
  }

  async upsertStreamer({
    platform,
    handle,
    displayName = null,
    notificationChannelId = null,
    acceptedBy = "manual",
    profileUrl = null,
    metadata = {},
    sourceApplicationId = null,
    enabled = true
  }) {
    const normalizedPlatform = normalizePlatform(platform);
    const normalizedHandle = normalizeHandle(handle);

    if (!supportedPlatforms.has(normalizedPlatform)) {
      throw new Error(
        `Unsupported platform "${platform}". Use one of: ${[...supportedPlatforms].join(", ")}.`
      );
    }

    if (!normalizedHandle) {
      throw new Error("A streamer handle is required.");
    }

    const watchlist = await this.getWatchlist();
    const key = makeStreamerKey(normalizedPlatform, normalizedHandle);
    const existing = watchlist.streamers.find(
      (streamer) => makeStreamerKey(streamer.platform, streamer.handle) === key
    );
    const now = new Date().toISOString();

    if (existing) {
      existing.displayName = displayName || existing.displayName || normalizedHandle;
      existing.notificationChannelId = notificationChannelId || existing.notificationChannelId || null;
      existing.acceptedBy = acceptedBy || existing.acceptedBy || "manual";
      existing.profileUrl = profileUrl || existing.profileUrl || null;
      existing.metadata = { ...(existing.metadata ?? {}), ...(metadata ?? {}) };
      existing.sourceApplicationId = sourceApplicationId || existing.sourceApplicationId || null;
      existing.enabled = enabled;
      existing.updatedAt = now;
      await this.saveWatchlist(watchlist);
      return existing;
    }

    const streamer = {
      id: randomUUID(),
      platform: normalizedPlatform,
      handle: normalizedHandle,
      displayName: displayName || normalizedHandle,
      notificationChannelId,
      acceptedBy,
      profileUrl,
      metadata,
      sourceApplicationId,
      enabled,
      createdAt: now,
      updatedAt: now
    };

    watchlist.streamers.push(streamer);
    await this.saveWatchlist(watchlist);
    return streamer;
  }

  async removeStreamer(platform, handle) {
    const key = makeStreamerKey(platform, handle);
    const watchlist = await this.getWatchlist();
    const originalCount = watchlist.streamers.length;
    watchlist.streamers = watchlist.streamers.filter(
      (streamer) => makeStreamerKey(streamer.platform, streamer.handle) !== key
    );

    await this.saveWatchlist(watchlist);
    return originalCount !== watchlist.streamers.length;
  }

  async setStreamerEnabled(platform, handle, enabled) {
    const key = makeStreamerKey(platform, handle);
    const watchlist = await this.getWatchlist();
    const streamer = watchlist.streamers.find(
      (entry) => makeStreamerKey(entry.platform, entry.handle) === key
    );

    if (!streamer) {
      return null;
    }

    streamer.enabled = enabled;
    streamer.updatedAt = new Date().toISOString();
    await this.saveWatchlist(watchlist);
    return streamer;
  }

  async seedTwitchChannels(handles) {
    const added = [];

    for (const handle of handles) {
      const normalizedHandle = normalizeHandle(handle);
      if (!normalizedHandle) {
        continue;
      }

      const existing = await this.listStreamers();
      const key = makeStreamerKey("twitch", normalizedHandle);
      if (existing.some((streamer) => makeStreamerKey(streamer.platform, streamer.handle) === key)) {
        continue;
      }

      added.push(
        await this.upsertStreamer({
          platform: "twitch",
          handle: normalizedHandle,
          displayName: normalizedHandle,
          acceptedBy: "env"
        })
      );
    }

    return added;
  }
}

function normalizeStreamerRecord(streamer) {
  const platform = normalizePlatform(streamer.platform);
  const handle = normalizeHandle(streamer.handle);

  return {
    id: streamer.id || randomUUID(),
    platform,
    handle,
    displayName: streamer.displayName || handle,
    notificationChannelId: streamer.notificationChannelId || null,
    acceptedBy: streamer.acceptedBy || "manual",
    profileUrl: streamer.profileUrl || null,
    metadata: streamer.metadata && typeof streamer.metadata === "object" ? streamer.metadata : {},
    sourceApplicationId: streamer.sourceApplicationId || null,
    enabled: streamer.enabled !== false,
    createdAt: streamer.createdAt || new Date().toISOString(),
    updatedAt: streamer.updatedAt || streamer.createdAt || new Date().toISOString()
  };
}

function normalizeApplicationRecord(application) {
  return {
    id: application.id || randomUUID(),
    type: normalizeApplicationType(application.type),
    status: application.status || "pending",
    answers: application.answers && typeof application.answers === "object" ? application.answers : {},
    channel: normalizeApplicationChannel(application.channel),
    reviewMessage:
      application.reviewMessage && typeof application.reviewMessage === "object"
        ? application.reviewMessage
        : null,
    reviewedBy: application.reviewedBy || null,
    reviewedAt: application.reviewedAt || null,
    reviewNote: application.reviewNote || null,
    createdAt: application.createdAt || new Date().toISOString(),
    updatedAt: application.updatedAt || application.createdAt || new Date().toISOString()
  };
}

function normalizeApplicationType(type) {
  return type === "staff" ? "staff" : "streamPartner";
}

function normalizeApplicationChannel(channel = null) {
  if (!channel) {
    return null;
  }

  const platform = normalizePlatform(channel.platform);
  const handle = normalizeHandle(channel.handle);

  return {
    platform,
    handle,
    displayName: channel.displayName || handle,
    profileUrl: channel.profileUrl || null,
    metadata: channel.metadata && typeof channel.metadata === "object" ? channel.metadata : {}
  };
}

async function recoverJsonWithTrailingData({ filePath, defaults, error }) {
  const raw = await fs.readFile(filePath, "utf8");
  const end = findCompleteJsonDocumentEnd(raw);

  if (end < 1) {
    throw error;
  }

  try {
    const recovered = { ...defaults, ...JSON.parse(raw.slice(0, end)) };
    const backupPath = `${filePath}.corrupt-${Date.now()}.bak`;
    await fs.writeFile(backupPath, raw, "utf8");
    await fs.writeFile(filePath, `${JSON.stringify(recovered, null, 2)}\n`, "utf8");
    console.warn(`Recovered ${path.basename(filePath)} after malformed trailing data.`);
    return recovered;
  } catch {
    throw error;
  }
}

function findCompleteJsonDocumentEnd(raw) {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return -1;
}
