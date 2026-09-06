import { EmbedBuilder } from "discord.js";
import { getPlatformName } from "../services/channelLinks.js";
import { formatTemplate } from "../utils.js";

const platformColors = {
  twitch: 0x9146ff,
  kick: 0x53fc18,
  youtube: 0xff0033,
  tiktok: 0x25f4ee
};

export class DiscordNotifier {
  constructor({
    client,
    defaultChannelId,
    liveRoleIds = [],
    liveRoleId = null,
    platformRoleIds = {},
    messageTemplate = "{displayName} is live on {platformName}: {url}"
  }) {
    this.client = client;
    this.defaultChannelId = defaultChannelId;
    const roleIds = Array.isArray(liveRoleIds) ? liveRoleIds : [liveRoleIds];
    this.liveRoleIds = [...new Set([...roleIds, liveRoleId].filter(Boolean))];
    this.platformRoleIds = normalizePlatformRoleIds(platformRoleIds);
    this.messageTemplate = messageTemplate;
  }

  async sendLiveNotification({ streamer, live }) {
    const channelId = streamer.notificationChannelId || this.defaultChannelId;
    const channel = await this.client.channels.fetch(channelId);

    if (!channel?.isTextBased()) {
      throw new Error(`Discord channel ${channelId} is not a text channel the bot can send to.`);
    }

    const content = this.buildContent({ streamer, live });
    const embed = this.buildEmbed({ streamer, live });

    await channel.send({
      content,
      embeds: [embed],
      allowedMentions: this.buildAllowedMentions(live)
    });
  }

  buildContent({ streamer, live }) {
    const text = formatTemplate(this.messageTemplate, {
      platform: live.platform,
      platformName: getPlatformName(live.platform),
      handle: live.handle,
      displayName: live.displayName || streamer.displayName,
      title: live.title,
      url: live.url
    });

    const roleIds = this.getRoleIdsForLive(live);

    if (roleIds.length === 0) {
      return text;
    }

    const mentions = roleIds.map((roleId) => `<@&${roleId}>`).join(" ");
    return `${mentions} ${text}`;
  }

  buildAllowedMentions(live) {
    const roleIds = this.getRoleIdsForLive(live);
    return roleIds.length > 0 ? { roles: roleIds } : { parse: [] };
  }

  getRoleIdsForLive(live) {
    const platformRoleIds = this.platformRoleIds[live.platform] ?? [];
    return platformRoleIds.length > 0 ? platformRoleIds : this.liveRoleIds;
  }

  buildEmbed({ streamer, live }) {
    const platformName = getPlatformName(live.platform);
    const embed = new EmbedBuilder()
      .setColor(platformColors[live.platform] ?? 0x3fbf8f)
      .setTitle(`${live.displayName || streamer.displayName} is live on ${platformName}`)
      .setURL(live.url)
      .setDescription(live.title)
      .addFields(
        { name: "Category", value: live.category || "No category", inline: true },
        {
          name: "Viewers",
          value: Number.isFinite(live.viewerCount) ? String(live.viewerCount) : "Unknown",
          inline: true
        }
      )
      .setTimestamp(live.startedAt ? new Date(live.startedAt) : new Date());

    if (live.thumbnailUrl) {
      embed.setImage(`${live.thumbnailUrl}?cache=${encodeURIComponent(live.streamId)}`);
    }

    return embed;
  }
}

function normalizePlatformRoleIds(platformRoleIds) {
  const normalized = {};

  for (const [platform, roleIds] of Object.entries(platformRoleIds ?? {})) {
    const list = Array.isArray(roleIds) ? roleIds : [roleIds];
    normalized[platform] = [...new Set(list.filter(Boolean))];
  }

  return normalized;
}
