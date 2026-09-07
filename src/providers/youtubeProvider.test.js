import test from "node:test";
import assert from "node:assert/strict";
import { YouTubeProvider } from "./youtubeProvider.js";

test("uses stored YouTube channel IDs when checking live state", async () => {
  const requests = [];
  const provider = new YouTubeProvider({
    apiKey: "test-key",
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      return jsonResponse({
        items: [
          {
            id: { videoId: "live-video-1" },
            snippet: {
              channelTitle: "Test Channel",
              title: "We are live",
              publishedAt: "2026-09-07T10:00:00Z",
              thumbnails: {
                high: { url: "https://img.example/high.jpg" }
              }
            }
          }
        ]
      });
    }
  });

  const [status] = await provider.getLiveStatuses([
    {
      platform: "youtube",
      handle: "UC123",
      displayName: "Stored Channel",
      metadata: { youtubeChannelId: "UC123" }
    }
  ]);

  assert.equal(status.isLive, true);
  assert.equal(status.live.streamId, "live-video-1");
  assert.equal(status.live.url, "https://www.youtube.com/watch?v=live-video-1");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].pathname, "/youtube/v3/search");
  assert.equal(requests[0].searchParams.get("channelId"), "UC123");
  assert.equal(requests[0].searchParams.get("eventType"), "live");
  assert.equal(requests[0].searchParams.get("type"), "video");
});

test("resolves YouTube handles before checking live state", async () => {
  const requests = [];
  const provider = new YouTubeProvider({
    apiKey: "test-key",
    fetchImpl: async (url) => {
      const request = new URL(url);
      requests.push(request);

      if (request.pathname.endsWith("/channels")) {
        return jsonResponse({ items: [{ id: "UC_HANDLE" }] });
      }

      return jsonResponse({ items: [] });
    }
  });

  const channelId = await provider.resolveChannelId({
    platform: "youtube",
    handle: "GoogleDevelopers",
    metadata: { youtubeHandle: "@GoogleDevelopers" }
  });

  assert.equal(channelId, "UC_HANDLE");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].searchParams.get("forHandle"), "@GoogleDevelopers");
});

test("resolves legacy YouTube usernames with forUsername", async () => {
  const requests = [];
  const provider = new YouTubeProvider({
    apiKey: "test-key",
    fetchImpl: async (url) => {
      const request = new URL(url);
      requests.push(request);

      if (request.searchParams.get("forUsername") === "LegacyUser") {
        return jsonResponse({ items: [{ id: "UC_LEGACY" }] });
      }

      return jsonResponse({ items: [] });
    }
  });

  const channelId = await provider.resolveChannelId({
    platform: "youtube",
    handle: "legacyuser",
    metadata: { youtubeLegacyPath: "user/LegacyUser" }
  });

  assert.equal(channelId, "UC_LEGACY");
  assert.equal(requests[0].searchParams.get("forUsername"), "LegacyUser");
});

test("falls back to channel search for custom YouTube paths", async () => {
  const requests = [];
  const provider = new YouTubeProvider({
    apiKey: "test-key",
    fetchImpl: async (url) => {
      const request = new URL(url);
      requests.push(request);

      if (request.pathname.endsWith("/channels")) {
        return jsonResponse({ items: [] });
      }

      return jsonResponse({
        items: [{ id: { channelId: "UC_CUSTOM" } }]
      });
    }
  });

  const channelId = await provider.resolveChannelId({
    platform: "youtube",
    handle: "customchannel",
    metadata: { youtubeLegacyPath: "c/CustomChannel" }
  });

  assert.equal(channelId, "UC_CUSTOM");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get("forHandle"), "@customchannel");
  assert.equal(requests[1].pathname, "/youtube/v3/search");
  assert.equal(requests[1].searchParams.get("q"), "CustomChannel");
  assert.equal(requests[1].searchParams.get("type"), "channel");
});

function jsonResponse(body) {
  return {
    ok: true,
    async json() {
      return body;
    }
  };
}
