import test from "node:test";
import assert from "node:assert/strict";
import { applicationTypes, validateApplicationForm } from "./applicationValidation.js";

test("validates a complete streamer partner application", () => {
  const result = validateApplicationForm({
    creatorName: "Creator#1234",
    content: "Gaming streams",
    channelLink: "https://twitch.tv/twitchdev",
    audienceSize: "100 followers",
    promoteCommunity: "yes",
    collaborate: "maybe",
    events: "no",
    futureVideosEvents: "yes"
  });

  assert.equal(result.isValid, true);
  assert.equal(result.applicationType, applicationTypes.streamPartner);
  assert.equal(result.parsedChannel.platform, "twitch");
});

test("returns useful errors for missing streamer partner fields", () => {
  const result = validateApplicationForm({});

  assert.equal(result.isValid, false);
  assert.ok(result.errors.creatorName);
  assert.ok(result.errors.channelLink);
});

test("validates a complete staff application", () => {
  const result = validateApplicationForm(
    {
      discordUsername: "StaffApplicant",
      timezone: "EST",
      age: "18",
      activeOnServer: "Every day after school",
      whyStaff: "I want to help the server stay welcoming.",
      goodFit: "I am calm, fair, and active.",
      previousStaffExperience: "I moderated a small gaming server for a year.",
      arguingMembers: "I would separate them, listen, and calm things down.",
      ruleBreaker: "I would check the rule, warn them, and escalate if needed.",
      friendRuleBreak: "I would treat them like anyone else.",
      staffAbuse: "I would document it and report it to higher staff.",
      hoursPerWeek: "10",
      understandsDecline: "yes"
    },
    applicationTypes.staff
  );

  assert.equal(result.isValid, true);
  assert.equal(result.applicationType, applicationTypes.staff);
  assert.equal(result.parsedChannel, null);
});

test("returns useful errors for missing staff fields", () => {
  const result = validateApplicationForm({}, applicationTypes.staff);

  assert.equal(result.isValid, false);
  assert.ok(result.errors.discordUsername);
  assert.ok(result.errors.timezone);
  assert.ok(result.errors.understandsDecline);
});
