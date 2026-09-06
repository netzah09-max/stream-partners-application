import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(srcDir, "..");

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function resolveProjectPath(value) {
  if (!value) {
    return path.join(projectRoot, "data");
  }

  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

export function parseCsv(value) {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function readLiveRoleIds() {
  return [
    ...new Set([
      ...parseCsv(process.env.DISCORD_LIVE_ROLE_IDS),
      ...parseCsv(process.env.discord_live_role_ids),
      process.env.DISCORD_LIVE_ROLE_ID?.trim(),
      process.env.discord_live_role_id?.trim()
    ].filter(Boolean).map(cleanRoleId))
  ];
}

function cleanRoleId(roleId) {
  return String(roleId).trim().replace(/^<@&(\d+)>$/, "$1");
}

function readRoleIdsFromEnv(names) {
  return [
    ...new Set(
      names
        .flatMap((name) => parseCsv(process.env[name]))
        .filter(Boolean)
        .map(cleanRoleId)
    )
  ];
}

function readPlatformRoleIds() {
  return {
    twitch: readRoleIdsFromEnv([
      "TWITCH_PING_ROLE_ID",
      "TWITCH_PING_ID",
      "DISCORD_TWITCH_PING_ROLE_ID"
    ]),
    kick: readRoleIdsFromEnv([
      "KICK_PING_ROLE_ID",
      "KICK_PING_ID",
      "DISCORD_KICK_PING_ROLE_ID"
    ]),
    youtube: readRoleIdsFromEnv([
      "YOUTUBE_PING_ROLE_ID",
      "YOUTUBE_PING_ID",
      "DISCORD_YOUTUBE_PING_ROLE_ID"
    ]),
    tiktok: readRoleIdsFromEnv([
      "TIKTOK_PING_ROLE_ID",
      "TIKTOK_PING_ID",
      "DISCORD_TIKTOK_PING_ROLE_ID"
    ])
  };
}

export function readDataConfig() {
  return {
    dataDir: resolveProjectPath(process.env.DATA_DIR ?? "./data")
  };
}

export function readTwitchConfig({ required = true } = {}) {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim() || null;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim() || null;

  if (!clientId || !clientSecret) {
    if (required) {
      const missing = [
        clientId ? null : "TWITCH_CLIENT_ID",
        clientSecret ? null : "TWITCH_CLIENT_SECRET"
      ]
        .filter(Boolean)
        .join(" and ");
      throw new Error(`Missing required environment variable: ${missing}`);
    }

    return null;
  }

  return { clientId, clientSecret };
}

export function readOptionalProviderConfig() {
  return {
    youtube: {
      apiKey: process.env.YOUTUBE_API_KEY?.trim() || null
    },
    tiktok: {
      liveCheckUrl: process.env.TIKTOK_LIVE_CHECK_URL?.trim() || null,
      liveCheckApiKey: process.env.TIKTOK_LIVE_CHECK_API_KEY?.trim() || null
    }
  };
}

export function readBotConfig() {
  const pollIntervalSeconds = Number.parseInt(process.env.POLL_INTERVAL_SECONDS ?? "60", 10);
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const liveRoleIds = readLiveRoleIds();
  const platformRoleIds = readPlatformRoleIds();

  if (!Number.isFinite(pollIntervalSeconds) || pollIntervalSeconds < 15) {
    throw new Error("POLL_INTERVAL_SECONDS must be a number of at least 15.");
  }

  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a number between 1 and 65535.");
  }

  return {
    discord: {
      token: requireEnv("DISCORD_BOT_TOKEN"),
      notificationChannelId: requireEnv("DISCORD_NOTIFICATION_CHANNEL_ID"),
      applicationsChannelId:
        process.env.DISCORD_APPLICATIONS_CHANNEL_ID?.trim() ||
        process.env.discord_applications_channel_id?.trim() ||
        null,
      liveRoleIds,
      platformRoleIds,
      liveRoleId: liveRoleIds[0] ?? null
    },
    twitch: readTwitchConfig({ required: false }),
    providers: readOptionalProviderConfig(),
    dataDir: readDataConfig().dataDir,
    initialTwitchChannels: parseCsv(process.env.TWITCH_CHANNELS),
    messageTemplate:
      process.env.MESSAGE_TEMPLATE?.trim() ||
      "{displayName} is live on {platformName}: {url}",
    pollIntervalMs: pollIntervalSeconds * 1000,
    web: {
      host: process.env.HOST?.trim() || "0.0.0.0",
      port,
      publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim() || `http://localhost:${port}`
    }
  };
}
