export const supportedPlatforms = new Set(["twitch", "kick", "youtube", "tiktok"]);

export function normalizePlatform(platform) {
  return String(platform ?? "").trim().toLowerCase();
}

export function normalizeHandle(handle) {
  let value = String(handle ?? "").trim();
  value = value.replace(/^@+/, "");

  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split("/").filter(Boolean);
    value = parts.at(-1) ?? parsed.hostname;
  } catch {
    // Not a URL, already a direct handle.
  }

  return value.replace(/^@+/, "").trim().toLowerCase();
}

export function makeStreamerKey(platform, handle) {
  return `${normalizePlatform(platform)}:${normalizeHandle(handle)}`;
}

export function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function formatTemplate(template, values) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    return values[key] ?? match;
  });
}
