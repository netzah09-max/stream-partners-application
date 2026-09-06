import test from "node:test";
import assert from "node:assert/strict";
import { DiscordNotifier } from "./discordNotifier.js";

test("builds live message content with the matching platform ping role", () => {
  const notifier = new DiscordNotifier({
    client: null,
    defaultChannelId: "channel",
    platformRoleIds: {
      twitch: ["111"],
      youtube: ["333"]
    }
  });

  const twitchContent = notifier.buildContent({
    streamer: { displayName: "Creator" },
    live: {
      platform: "twitch",
      handle: "creator",
      displayName: "Creator",
      title: "Going live",
      url: "https://www.twitch.tv/creator"
    }
  });

  assert.equal(
    twitchContent,
    "<@&111> Creator is live on Twitch: https://www.twitch.tv/creator"
  );

  const youtubeContent = notifier.buildContent({
    streamer: { displayName: "Creator" },
    live: {
      platform: "youtube",
      handle: "creator",
      displayName: "Creator",
      title: "Going live",
      url: "https://www.youtube.com/watch?v=live"
    }
  });

  assert.equal(
    youtubeContent,
    "<@&333> Creator is live on YouTube: https://www.youtube.com/watch?v=live"
  );
});

test("falls back to global live role IDs when a platform ping role is missing", () => {
  const notifier = new DiscordNotifier({
    client: null,
    defaultChannelId: "channel",
    liveRoleIds: ["999"]
  });

  const content = notifier.buildContent({
    streamer: { displayName: "Creator" },
    live: {
      platform: "kick",
      handle: "creator",
      displayName: "Creator",
      title: "Going live",
      url: "https://kick.com/creator"
    }
  });

  assert.equal(content, "<@&999> Creator is live on Kick: https://kick.com/creator");
});
