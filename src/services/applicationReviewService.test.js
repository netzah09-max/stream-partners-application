import test from "node:test";
import assert from "node:assert/strict";
import {
  buildApplicationEmbed,
  extractDiscordUserId,
  memberMatchesApplicantName
} from "./applicationReviewService.js";

test("extracts a Discord user ID from a raw ID or mention", () => {
  assert.equal(extractDiscordUserId("1544450766129860688"), "1544450766129860688");
  assert.equal(extractDiscordUserId("<@1544450766129860688>"), "1544450766129860688");
  assert.equal(extractDiscordUserId("<@!1544450766129860688>"), "1544450766129860688");
  assert.equal(extractDiscordUserId("creator"), null);
});

test("matches an applicant name to a Discord guild member", () => {
  const member = {
    nickname: "Stream Lead",
    displayName: "Stream Lead",
    user: {
      id: "1544450766129860688",
      username: "creatorname",
      tag: "creatorname#0000",
      globalName: "Creator Name"
    }
  };

  assert.equal(memberMatchesApplicantName(member, "creatorname"), true);
  assert.equal(memberMatchesApplicantName(member, "@creatorname"), true);
  assert.equal(memberMatchesApplicantName(member, "Creator Name"), true);
  assert.equal(memberMatchesApplicantName(member, "different"), false);
});

test("builds a staff application review embed without a stream channel", () => {
  const embed = buildApplicationEmbed({
    id: "staff-1",
    type: "staff",
    status: "pending",
    createdAt: "2026-09-07T00:00:00.000Z",
    answers: {
      discordUsername: "StaffApplicant",
      timezone: "EST",
      age: "18",
      activeOnServer: "Daily",
      whyStaff: "I want to help.",
      goodFit: "I stay calm.",
      previousStaffExperience: "Small server moderator.",
      arguingMembers: "Listen and calm them down.",
      ruleBreaker: "Warn and escalate if needed.",
      friendRuleBreak: "Treat them fairly.",
      staffAbuse: "Report it.",
      hoursPerWeek: "10",
      understandsDecline: "yes"
    },
    channel: null
  }).toJSON();

  assert.equal(embed.title, "PENDING: Staff - StaffApplicant");
  assert.ok(embed.fields.some((field) => field.name === "Staff Abuse"));
});
