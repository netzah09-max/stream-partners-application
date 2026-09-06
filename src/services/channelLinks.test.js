import test from "node:test";
import assert from "node:assert/strict";
import { parseChannelLink } from "./channelLinks.js";

test("parses supported channel links", () => {
  assert.deepEqual(parseChannelLink("https://twitch.tv/TwitchDev"), {
    platform: "twitch",
    handle: "twitchdev",
    displayName: "TwitchDev",
    profileUrl: "https://www.twitch.tv/twitchdev",
    metadata: {}
  });

  assert.equal(parseChannelLink("kick.com/xQc").platform, "kick");
  assert.equal(
    parseChannelLink("https://youtube.com/@GoogleDevelopers").metadata.youtubeHandle,
    "@GoogleDevelopers"
  );
  assert.equal(
    parseChannelLink("https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw").metadata.youtubeChannelId,
    "UC_x5XG1OV2P6uZZ5FSM9Ttw"
  );
  assert.equal(parseChannelLink("https://www.tiktok.com/@some_creator/live").handle, "some_creator");
});

test("rejects video links instead of channel links", () => {
  assert.throws(
    () => parseChannelLink("https://youtu.be/dQw4w9WgXcQ"),
    /YouTube channel link/
  );
});
