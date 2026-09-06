import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags
} from "discord.js";
import { getPlatformName } from "./channelLinks.js";

const statusColors = {
  pending: 0xf3c969,
  accepted: 0x3fbf8f,
  rejected: 0xe15d5d
};

export class ApplicationReviewService {
  constructor({
    client,
    store,
    applicationsChannelId,
    liveNotificationChannelId,
    logger = console
  }) {
    this.client = client;
    this.store = store;
    this.applicationsChannelId = applicationsChannelId;
    this.liveNotificationChannelId = liveNotificationChannelId;
    this.logger = logger;
  }

  async sendApplicationReview(application) {
    if (!this.applicationsChannelId) {
      throw new Error("DISCORD_APPLICATIONS_CHANNEL_ID is not set.");
    }

    const channel = await this.client.channels.fetch(this.applicationsChannelId);
    if (!channel?.isTextBased()) {
      throw new Error(`Discord channel ${this.applicationsChannelId} is not a text channel.`);
    }

    const message = await channel.send({
      content: `New partner application: ${application.answers.creatorName}`,
      embeds: [buildApplicationEmbed(application)],
      components: buildReviewComponents(application),
      allowedMentions: { parse: [] }
    });

    await this.store.linkApplicationReviewMessage(application.id, {
      channelId: message.channelId,
      messageId: message.id
    });

    return message;
  }

  async handleInteraction(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith("application:")) {
      return false;
    }

    const [, action, applicationId] = interaction.customId.split(":");
    if (!["accept", "reject"].includes(action) || !applicationId) {
      return false;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const application = await this.store.getApplication(applicationId);
    if (!application) {
      await interaction.editReply("I could not find that application anymore.");
      return true;
    }

    if (application.status !== "pending") {
      await interaction.editReply(`That application was already ${application.status}.`);
      return true;
    }

    const reviewedBy = {
      id: interaction.user.id,
      tag: interaction.user.tag
    };

    if (action === "accept") {
      await this.acceptApplication({ application, reviewedBy, interaction });
      return true;
    }

    await this.rejectApplication({ application, reviewedBy, interaction });
    return true;
  }

  async acceptApplication({ application, reviewedBy, interaction }) {
    const streamer = await this.store.upsertStreamer({
      platform: application.channel.platform,
      handle: application.channel.handle,
      displayName: application.channel.displayName || application.answers.creatorName,
      notificationChannelId: this.liveNotificationChannelId,
      acceptedBy: `${reviewedBy.tag} (${reviewedBy.id})`,
      profileUrl: application.channel.profileUrl,
      metadata: {
        ...application.channel.metadata,
        applicationId: application.id
      },
      sourceApplicationId: application.id,
      enabled: true
    });
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: "accepted",
      reviewedBy,
      reviewNote: `Added ${streamer.platform}:${streamer.handle} to live notifications.`
    });

    await this.updateReviewMessage(interaction, updated);
    await interaction.editReply(
      `Accepted ${application.answers.creatorName}. ${getPlatformName(streamer.platform)} link is now on the live notification list.`
    );
  }

  async rejectApplication({ application, reviewedBy, interaction }) {
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: "rejected",
      reviewedBy,
      reviewNote: "Application rejected in Discord."
    });

    await this.updateReviewMessage(interaction, updated);
    await interaction.editReply(`Rejected ${application.answers.creatorName}.`);
  }

  async updateReviewMessage(interaction, application) {
    try {
      await interaction.message.edit({
        embeds: [buildApplicationEmbed(application)],
        components: buildReviewComponents(application, true)
      });
    } catch (error) {
      this.logger.warn("Could not update application review message:", error);
    }
  }
}

export function buildApplicationEmbed(application) {
  const platformName = getPlatformName(application.channel.platform);
  const status = application.status ?? "pending";
  const statusLabel = status.toUpperCase();
  const answers = application.answers;
  const embed = new EmbedBuilder()
    .setColor(statusColors[status] ?? statusColors.pending)
    .setTitle(`${statusLabel}: ${answers.creatorName}`)
    .setDescription(
      [
        `Channel: ${application.channel.profileUrl}`,
        `Platform: ${platformName}`,
        status === "pending" ? "Accepting this will add the channel to live notifications." : null
      ]
        .filter(Boolean)
        .join("\n")
    )
    .addFields(
      field("Contact", answers.contact || "Not provided", true),
      field("Audience", answers.audienceSize, true),
      field("Content", answers.content),
      field("Promote Community", labelChoice(answers.promoteCommunity), true),
      field("Create With Partners", labelChoice(answers.collaborate), true),
      field("Events And Activities", labelChoice(answers.events), true)
    )
    .setTimestamp(new Date(application.createdAt));

  if (answers.notes) {
    embed.addFields(field("Notes", answers.notes));
  }

  if (application.reviewedBy) {
    embed.addFields(
      field("Reviewed By", `${application.reviewedBy.tag} (${application.reviewedBy.id})`, true)
    );
  }

  if (application.reviewNote) {
    embed.setFooter({ text: application.reviewNote });
  }

  return embed;
}

export function buildReviewComponents(application, forceDisabled = false) {
  const disabled = forceDisabled || application.status !== "pending";

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`application:accept:${application.id}`)
        .setLabel("Accept")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`application:reject:${application.id}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    )
  ];
}

function field(name, value, inline = false) {
  return {
    name,
    value: limitText(String(value || "Not provided"), 1024),
    inline
  };
}

function limitText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function labelChoice(value) {
  const choices = {
    yes: "Yes",
    maybe: "Maybe",
    no: "No"
  };

  return choices[value] ?? "Not provided";
}
