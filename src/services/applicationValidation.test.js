import test from "node:test";
import assert from "node:assert/strict";
import { validateApplicationForm } from "./applicationValidation.js";

test("validates a complete application", () => {
  const result = validateApplicationForm({
    creatorName: "Creator#1234",
    content: "Gaming streams",
    channelLink: "https://twitch.tv/twitchdev",
    audienceSize: "100 followers",
    promoteCommunity: "yes",
    collaborate: "maybe",
    events: "no"
  });

  assert.equal(result.isValid, true);
  assert.equal(result.parsedChannel.platform, "twitch");
});

test("returns useful errors for missing application fields", () => {
  const result = validateApplicationForm({});

  assert.equal(result.isValid, false);
  assert.ok(result.errors.creatorName);
  assert.ok(result.errors.channelLink);
});
