import test from "node:test";
import assert from "node:assert/strict";
import {
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
