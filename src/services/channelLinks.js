import { normalizeHandle, normalizePlatform } from "../utils.js";

const twitchReservedPaths = new Set([
  "directory",
  "downloads",
  "jobs",
  "p",
  "popout",
  "settings",
  "store",
  "turbo",
  "videos"
]);

export function parseChannelLink(input) {
  const original = String(input ?? "").trim();
  if (!original) {
    throw new Error("Channel link is required.");
  }

  const url = parseUrl(original);
  const host = normalizeHost(url.hostname);
  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  if (isTwitchHost(host)) {
    return parseTwitchLink(segments);
  }

  if (isKickHost(host)) {
    return parseKickLink(segments);
  }

  if (isYouTubeHost(host)) {
    return parseYouTubeLink(segments);
  }

  if (isTikTokHost(host)) {
    return parseTikTokLink(segments);
  }

  throw new Error("Use a Twitch, Kick, YouTube, or TikTok channel link.");
}

export function getPlatformName(platform) {
  const names = {
    twitch: "Twitch",
    kick: "Kick",
    youtube: "YouTube",
    tiktok: "TikTok"
  };

  return names[normalizePlatform(platform)] ?? platform;
}

function parseUrl(input) {
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  try {
    return new URL(withProtocol);
  } catch {
    throw new Error("Channel link must be a valid URL.");
  }
}

function normalizeHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
}

function isTwitchHost(host) {
  return host === "twitch.tv" || host.endsWith(".twitch.tv");
}

function isKickHost(host) {
  return host === "kick.com" || host.endsWith(".kick.com");
}

function isYouTubeHost(host) {
  return host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com");
}

function isTikTokHost(host) {
  return host === "tiktok.com" || host.endsWith(".tiktok.com");
}

function parseTwitchLink(segments) {
  const handle = segments[0]?.replace(/^@/, "");

  if (!handle || twitchReservedPaths.has(handle.toLowerCase())) {
    throw new Error("Please share a Twitch channel link like https://twitch.tv/channelname.");
  }

  const normalizedHandle = normalizeHandle(handle);
  return {
    platform: "twitch",
    handle: normalizedHandle,
    displayName: handle,
    profileUrl: `https://www.twitch.tv/${normalizedHandle}`,
    metadata: {}
  };
}

function parseKickLink(segments) {
  const handle = segments[0]?.replace(/^@/, "");

  if (!handle || ["api", "video", "category"].includes(handle.toLowerCase())) {
    throw new Error("Please share a Kick channel link like https://kick.com/channelname.");
  }

  const normalizedHandle = normalizeHandle(handle);
  return {
    platform: "kick",
    handle: normalizedHandle,
    displayName: handle,
    profileUrl: `https://kick.com/${normalizedHandle}`,
    metadata: {}
  };
}

function parseYouTubeLink(segments) {
  const [first, second] = segments;

  if (first?.startsWith("@")) {
    const displayHandle = first.slice(1);
    const normalizedHandle = normalizeHandle(displayHandle);
    return {
      platform: "youtube",
      handle: normalizedHandle,
      displayName: displayHandle,
      profileUrl: `https://www.youtube.com/@${displayHandle}`,
      metadata: {
        youtubeHandle: `@${displayHandle}`
      }
    };
  }

  if (first?.toLowerCase() === "channel" && second) {
    return {
      platform: "youtube",
      handle: normalizeHandle(second),
      displayName: second,
      profileUrl: `https://www.youtube.com/channel/${second}`,
      metadata: {
        youtubeChannelId: second
      }
    };
  }

  if (["c", "user"].includes(first?.toLowerCase()) && second) {
    return {
      platform: "youtube",
      handle: normalizeHandle(second),
      displayName: second,
      profileUrl: `https://www.youtube.com/${first}/${second}`,
      metadata: {
        youtubeLegacyPath: `${first}/${second}`
      }
    };
  }

  throw new Error("Please share a YouTube channel link like https://youtube.com/@channelname.");
}

function parseTikTokLink(segments) {
  const handleSegment = segments.find((segment) => segment.startsWith("@"));
  const handle = handleSegment?.slice(1);

  if (!handle) {
    throw new Error("Please share a TikTok profile link like https://tiktok.com/@username.");
  }

  const normalizedHandle = normalizeHandle(handle);
  return {
    platform: "tiktok",
    handle: normalizedHandle,
    displayName: handle,
    profileUrl: `https://www.tiktok.com/@${normalizedHandle}`,
    metadata: {}
  };
}
