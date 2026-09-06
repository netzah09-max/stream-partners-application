import test from "node:test";
import assert from "node:assert/strict";
import { TwitchProvider } from "./twitchProvider.js";

test("maps Twitch live streams back to watchlist entries", async () => {
  const provider = new TwitchProvider({
    api: {
      async getStreamsByLogin(logins) {
        assert.deepEqual(logins, ["twitchdev", "offlineuser"]);
        return [
          {
            id: "123",
            user_login: "twitchdev",
            user_name: "TwitchDev",
            title: "Developer stream",
            game_name: "Science & Technology",
            viewer_count: 42,
            started_at: "2026-09-06T10:00:00Z",
            thumbnail_url: "https://example.com/{width}x{height}.jpg"
          }
        ];
      }
    }
  });

  const statuses = await provider.getLiveStatuses([
    { platform: "twitch", handle: "TwitchDev", displayName: "TwitchDev" },
    { platform: "twitch", handle: "offlineuser", displayName: "OfflineUser" }
  ]);

  assert.equal(statuses[0].isLive, true);
  assert.equal(statuses[0].live.streamId, "123");
  assert.equal(statuses[0].live.thumbnailUrl, "https://example.com/1280x720.jpg");
  assert.equal(statuses[1].isLive, false);
});
