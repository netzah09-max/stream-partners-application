import "dotenv/config";

const token = process.env.DISCORD_BOT_TOKEN?.trim();
const channels = [
  ["DISCORD_APPLICATIONS_CHANNEL_ID", process.env.DISCORD_APPLICATIONS_CHANNEL_ID?.trim()],
  [
    "DISCORD_STAFF_APPLICATIONS_CHANNEL_ID",
    process.env.DISCORD_STAFF_APPLICATIONS_CHANNEL_ID?.trim()
  ],
  ["DISCORD_NOTIFICATION_CHANNEL_ID", process.env.DISCORD_NOTIFICATION_CHANNEL_ID?.trim()]
];

if (!token) {
  console.error("DISCORD_BOT_TOKEN is missing from .env.");
  process.exit(1);
}

let hadError = false;

for (const [name, channelId] of channels) {
  if (!channelId) {
    console.error(`${name} is missing from .env.`);
    hadError = true;
    continue;
  }

  const result = await checkChannel({ token, channelId });
  if (result.ok) {
    console.log(`OK   ${name}: ${result.channel.name} (${result.channel.id})`);
    continue;
  }

  hadError = true;
  console.error(`FAIL ${name}: ${channelId}`);
  console.error(`     ${result.message}`);
}

if (hadError) {
  process.exit(1);
}

async function checkChannel({ token, channelId }) {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
    headers: {
      Authorization: `Bot ${token}`,
      Accept: "application/json"
    }
  });

  const json = await response.json().catch(() => ({}));

  if (response.ok) {
    return { ok: true, channel: json };
  }

  if (response.status === 403 || json.code === 50001) {
    return {
      ok: false,
      message:
        "Discord says Missing Access. Add the bot directly to this text channel permissions with View Channel, Send Messages, and Embed Links."
    };
  }

  if (response.status === 404 || json.code === 10003) {
    return {
      ok: false,
      message:
        "Discord could not find that channel. Make sure you copied the channel ID, not a role/server/category ID."
    };
  }

  return {
    ok: false,
    message: `Discord returned ${response.status}: ${json.message ?? "Unknown error"}`
  };
}
