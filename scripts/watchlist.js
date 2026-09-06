import { readDataConfig } from "../src/config.js";
import { JsonFileStore } from "../src/storage/jsonStore.js";

const usage = `
Usage:
  npm run watch:add -- <platform> <handle> [--name=DisplayName] [--channel-id=123]
  npm run watch:remove -- <platform> <handle>
  npm run watch:disable -- <platform> <handle>
  npm run watch:enable -- <platform> <handle>
  npm run watch:list

Platforms accepted in the data file: twitch, kick, youtube, tiktok
Only Twitch notifications are implemented in the bot right now.
`.trim();

async function main() {
  const [command, platform, handle, ...rawOptions] = process.argv.slice(2);
  const store = new JsonFileStore(readDataConfig());
  const options = parseOptions(rawOptions);

  if (!command || command === "help" || command === "--help") {
    console.log(usage);
    return;
  }

  if (command === "list") {
    await list(store);
    return;
  }

  if (!platform || !handle) {
    throw new Error(`Missing platform or handle.\n\n${usage}`);
  }

  if (command === "add") {
    const streamer = await store.upsertStreamer({
      platform,
      handle,
      displayName: options.name,
      notificationChannelId: options.channelId,
      acceptedBy: "manual"
    });
    console.log(`Saved ${streamer.platform}:${streamer.handle} (${streamer.displayName}).`);
    return;
  }

  if (command === "remove") {
    const removed = await store.removeStreamer(platform, handle);
    console.log(removed ? `Removed ${platform}:${handle}.` : `No streamer found for ${platform}:${handle}.`);
    return;
  }

  if (command === "disable" || command === "enable") {
    const enabled = command === "enable";
    const streamer = await store.setStreamerEnabled(platform, handle, enabled);
    console.log(
      streamer
        ? `${enabled ? "Enabled" : "Disabled"} ${streamer.platform}:${streamer.handle}.`
        : `No streamer found for ${platform}:${handle}.`
    );
    return;
  }

  throw new Error(`Unknown command "${command}".\n\n${usage}`);
}

async function list(store) {
  const streamers = await store.listStreamers();

  if (streamers.length === 0) {
    console.log("Watchlist is empty.");
    return;
  }

  for (const streamer of streamers) {
    const status = streamer.enabled ? "enabled" : "disabled";
    const channel = streamer.notificationChannelId
      ? ` -> Discord channel ${streamer.notificationChannelId}`
      : "";
    console.log(`${streamer.platform}:${streamer.handle} (${streamer.displayName}) [${status}]${channel}`);
  }
}

function parseOptions(rawOptions) {
  const options = {};

  for (const rawOption of rawOptions) {
    const [key, ...valueParts] = rawOption.split("=");
    const value = valueParts.join("=");

    if (key === "--name") {
      options.name = value;
    }

    if (key === "--channel-id") {
      options.channelId = value;
    }
  }

  return options;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
