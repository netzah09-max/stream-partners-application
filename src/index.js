import { Client, Events, GatewayIntentBits } from "discord.js";
import { readBotConfig } from "./config.js";
import { JsonFileStore } from "./storage/jsonStore.js";
import { TwitchApi } from "./services/twitchApi.js";
import { TwitchProvider } from "./providers/twitchProvider.js";
import { KickProvider } from "./providers/kickProvider.js";
import { YouTubeProvider } from "./providers/youtubeProvider.js";
import { TikTokProvider } from "./providers/tiktokProvider.js";
import { DiscordNotifier } from "./notifiers/discordNotifier.js";
import { LiveMonitor } from "./liveMonitor.js";
import { ApplicationReviewService } from "./services/applicationReviewService.js";
import { sendNewMemberWelcome } from "./services/welcomeService.js";
import { startWebServer } from "./web/server.js";

async function main() {
  const config = readBotConfig();
  const store = new JsonFileStore({ dataDir: config.dataDir });
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
  });
  let monitor = null;
  let webServer = null;
  let reviewService = null;

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!reviewService) {
      return;
    }

    try {
      await reviewService.handleInteraction(interaction);
    } catch (error) {
      console.error("Application review interaction failed:", error);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Something went wrong while reviewing that application.",
          ephemeral: true
        });
      }
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      await sendNewMemberWelcome(member);
    } catch (error) {
      console.error("New member welcome DM failed:", error);
    }
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}.`);

    const seeded = await store.seedTwitchChannels(config.initialTwitchChannels);
    if (seeded.length > 0) {
      console.log(`Seeded ${seeded.length} Twitch channel(s) from TWITCH_CHANNELS.`);
    }

    const providers = {
      kick: new KickProvider({})
    };

    if (config.twitch) {
      const twitchApi = new TwitchApi(config.twitch);
      providers.twitch = new TwitchProvider({ api: twitchApi });
    }

    if (config.providers.youtube.apiKey) {
      providers.youtube = new YouTubeProvider({ apiKey: config.providers.youtube.apiKey });
    }

    if (config.providers.tiktok.liveCheckUrl) {
      providers.tiktok = new TikTokProvider({
        liveCheckUrl: config.providers.tiktok.liveCheckUrl,
        apiKey: config.providers.tiktok.liveCheckApiKey
      });
    }

    const notifier = new DiscordNotifier({
      client,
      defaultChannelId: config.discord.notificationChannelId,
      liveRoleIds: config.discord.liveRoleIds,
      platformRoleIds: config.discord.platformRoleIds,
      messageTemplate: config.messageTemplate
    });
    reviewService = new ApplicationReviewService({
      client,
      store,
      applicationReviews: config.discord.applicationReviews,
      liveNotificationChannelId: config.discord.notificationChannelId
    });

    monitor = new LiveMonitor({
      store,
      providers,
      notifier,
      pollIntervalMs: config.pollIntervalMs
    });

    await monitor.start();
    console.log(`Live monitor running every ${config.pollIntervalMs / 1000} seconds.`);

    webServer = await startWebServer({
      config,
      store,
      reviewService
    });
  });

  process.on("SIGINT", () => shutdown({ client, monitor, webServer }));
  process.on("SIGTERM", () => shutdown({ client, monitor, webServer }));

  await client.login(config.discord.token);
}

function shutdown({ client, monitor, webServer }) {
  console.log("Shutting down live bot.");
  monitor?.stop();
  webServer?.close();
  client.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
