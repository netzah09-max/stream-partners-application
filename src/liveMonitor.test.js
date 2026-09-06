import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { LiveMonitor } from "./liveMonitor.js";
import { JsonFileStore } from "./storage/jsonStore.js";

test("notifies once for the same live stream id", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "discord-live-bot-"));
  const store = new JsonFileStore({ dataDir });
  await store.upsertStreamer({ platform: "twitch", handle: "twitchdev" });

  const sent = [];
  const monitor = new LiveMonitor({
    store,
    providers: {
      twitch: {
        async getLiveStatuses(streamers) {
          return streamers.map((streamer) => ({
            streamer,
            isLive: true,
            live: {
              platform: "twitch",
              streamId: "same-stream",
              handle: "twitchdev",
              displayName: "TwitchDev",
              title: "Still live",
              category: "Science & Technology",
              viewerCount: 10,
              startedAt: "2026-09-06T10:00:00Z",
              thumbnailUrl: null,
              url: "https://www.twitch.tv/twitchdev"
            }
          }));
        }
      }
    },
    notifier: {
      async sendLiveNotification(payload) {
        sent.push(payload);
      }
    },
    pollIntervalMs: 60_000,
    logger: silentLogger()
  });

  await monitor.tick();
  await monitor.tick();

  assert.equal(sent.length, 1);
  await rm(dataDir, { recursive: true, force: true });
});

function silentLogger() {
  return {
    log() {},
    warn() {},
    error() {}
  };
}
