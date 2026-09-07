const rulesChannelUrl =
  "https://discord.com/channels/1544336598827540480/1546601365004882031";
const infoChannelUrl =
  "https://discord.com/channels/1544336598827540480/1545035705728892970";

export function buildNewMemberWelcomeMessage(memberOrUser = {}) {
  const user = memberOrUser.user ?? memberOrUser;
  const mention = user.id ? `<@${user.id}>` : "there";

  return [
    `Welcome To ༒𝑺𝒕𝒓𝒆𝒂𝒎 𝑺𝒚𝒏𝒅𝒊𝒄𝒂𝒕𝒆༒, ${mention}!`,
    "",
    `Checkout ${rulesChannelUrl}`,
    `And ${infoChannelUrl}`,
    "",
    "Hope you enjoy your stay!"
  ].join("\n");
}

export async function sendNewMemberWelcome(member) {
  if (member.user?.bot) {
    return { sent: false, reason: "bot-user" };
  }

  await member.send({
    content: buildNewMemberWelcomeMessage(member),
    allowedMentions: { users: [member.id], roles: [], parse: [] }
  });

  return { sent: true };
}
