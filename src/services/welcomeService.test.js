import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNewMemberWelcomeMessage,
  sendNewMemberWelcome
} from "./welcomeService.js";

test("builds the new member welcome DM with required server links", () => {
  const message = buildNewMemberWelcomeMessage({
    user: { id: "123456789012345678" }
  });

  assert.match(message, /Welcome To ༒𝑺𝒕𝒓𝒆𝒂𝒎 𝑺𝒚𝒏𝒅𝒊𝒄𝒂𝒕𝒆༒/);
  assert.match(message, /<@123456789012345678>/);
  assert.match(
    message,
    /https:\/\/discord\.com\/channels\/1544336598827540480\/1546601365004882031/
  );
  assert.match(
    message,
    /https:\/\/discord\.com\/channels\/1544336598827540480\/1545035705728892970/
  );
  assert.match(message, /Hope you enjoy your stay!/);
});

test("does not send welcome DMs to bots", async () => {
  let sent = false;
  const result = await sendNewMemberWelcome({
    id: "123",
    user: { bot: true },
    async send() {
      sent = true;
    }
  });

  assert.equal(sent, false);
  assert.deepEqual(result, { sent: false, reason: "bot-user" });
});
