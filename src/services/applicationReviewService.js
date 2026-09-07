import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags
} from "discord.js";
import { getPlatformName } from "./channelLinks.js";
import { applicationTypes } from "./applicationValidation.js";

const statusColors = {
  pending: 0xf3c969,
  accepted: 0x3fbf8f,
  rejected: 0xe15d5d
};

export class ApplicationReviewService {
  constructor({
    client,
    store,
    applicationReviews = {},
    applicationsChannelId = null,
    acceptedRoleId = null,
    liveNotificationChannelId,
    logger = console
  }) {
    this.client = client;
    this.store = store;
    this.applicationReviews = normalizeApplicationReviews({
      applicationReviews,
      applicationsChannelId,
      acceptedRoleId
    });
    this.liveNotificationChannelId = liveNotificationChannelId;
    this.logger = logger;
  }

  async sendApplicationReview(application) {
    const reviewConfig = this.getReviewConfig(application);
    if (!reviewConfig.channelId) {
      throw new Error(`${getApplicationsChannelEnvName(application)} is not set.`);
    }

    const channel = await this.client.channels.fetch(reviewConfig.channelId);
    if (!channel?.isTextBased()) {
      throw new Error(`Discord channel ${reviewConfig.channelId} is not a text channel.`);
    }

    const message = await channel.send({
      content: `New ${getApplicationTypeLabel(application).toLowerCase()} application: ${getApplicantDiscordInput(application) || "Unknown applicant"}`,
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
    if (getApplicationType(application) === applicationTypes.staff) {
      await this.acceptStaffApplication({ application, reviewedBy, interaction });
      return;
    }

    await this.acceptStreamPartnerApplication({ application, reviewedBy, interaction });
  }

  async acceptStreamPartnerApplication({ application, reviewedBy, interaction }) {
    const streamer = await this.store.upsertStreamer({
      platform: application.channel.platform,
      handle: application.channel.handle,
      displayName: application.channel.displayName || getApplicantDiscordInput(application),
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
    const roleAssignment = await this.assignAcceptedRole({ application, interaction });
    const dmDelivery = await this.sendApplicantReviewDm({
      application,
      interaction,
      status: "accepted"
    });
    const reviewNote = [
      `Added ${streamer.platform}:${streamer.handle} to live notifications.`,
      roleAssignment?.reviewNote,
      dmDelivery.reviewNote
    ]
      .filter(Boolean)
      .join(" ");
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: "accepted",
      reviewedBy,
      reviewNote
    });

    await this.updateReviewMessage(interaction, updated);
    const reply = [
      `Accepted ${getApplicantDiscordInput(application)}. ${getPlatformName(streamer.platform)} link is now on the live notification list.`,
      roleAssignment?.replyNote,
      dmDelivery.replyNote
    ]
      .filter(Boolean)
      .join(" ");
    await interaction.editReply(reply);
  }

  async acceptStaffApplication({ application, reviewedBy, interaction }) {
    const roleAssignment = await this.assignAcceptedRole({ application, interaction });
    const dmDelivery = await this.sendApplicantReviewDm({
      application,
      interaction,
      status: "accepted"
    });
    const reviewNote = [
      "Staff application accepted.",
      roleAssignment?.reviewNote,
      dmDelivery.reviewNote
    ]
      .filter(Boolean)
      .join(" ");
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: "accepted",
      reviewedBy,
      reviewNote
    });

    await this.updateReviewMessage(interaction, updated);
    await interaction.editReply(
      [
        `Accepted staff applicant ${getApplicantDiscordInput(application)}.`,
        roleAssignment?.replyNote,
        dmDelivery.replyNote
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  async assignAcceptedRole({ application, interaction }) {
    const roleId = this.getReviewConfig(application).acceptedRoleId;
    if (!roleId) {
      return null;
    }

    const guild = await resolveInteractionGuild(this.client, interaction);
    if (!guild) {
      return roleAssignmentResult(
        "Accepted role not added: no Discord server was found.",
        "I could not add the accepted role because this review was not connected to a server."
      );
    }

    const role = await guild.roles.fetch(roleId).catch((error) => {
      this.logger.warn("Could not fetch accepted applicant role:", error);
      return null;
    });
    if (!role) {
      return roleAssignmentResult(
        "Accepted role not added: configured role was not found.",
        "I could not add the accepted role because that role ID was not found in this server."
      );
    }

    const member = await findGuildMemberByApplicantName(
      guild,
      getApplicantDiscordInput(application),
      this.logger
    );
    if (!member) {
      return roleAssignmentResult(
        "Accepted role not added: applicant username was not found.",
        "I accepted the application, but could not find that Discord username to add the role."
      );
    }

    try {
      await member.roles.add(roleId, `Accepted ${getApplicationTypeLabel(application)} application ${application.id}`);
    } catch (error) {
      this.logger.warn("Could not assign accepted applicant role:", error);
      return roleAssignmentResult(
        "Accepted role not added: check Manage Roles permission and role order.",
        "I accepted the application, but could not add the role. Check the bot's Manage Roles permission and make sure the bot role is above the accepted role."
      );
    }

    const userLabel = formatDiscordUser(member.user);
    return roleAssignmentResult(
      `Accepted role assigned to ${userLabel}.`,
      `Accepted role added to ${userLabel}.`
    );
  }

  async rejectApplication({ application, reviewedBy, interaction }) {
    const dmDelivery = await this.sendApplicantReviewDm({
      application,
      interaction,
      status: "rejected"
    });
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: "rejected",
      reviewedBy,
      reviewNote: ["Application rejected in Discord.", dmDelivery.reviewNote]
        .filter(Boolean)
        .join(" ")
    });

    await this.updateReviewMessage(interaction, updated);
    await interaction.editReply(
      [`Rejected ${getApplicantDiscordInput(application)}.`, dmDelivery.replyNote]
        .filter(Boolean)
        .join(" ")
    );
  }

  async sendApplicantReviewDm({ application, interaction, status }) {
    const user = await this.findApplicantUser({ application, interaction });
    if (!user) {
      return dmDeliveryResult(
        "DM not sent: applicant Discord account was not found.",
        "I could not DM the applicant because I could not find that Discord account."
      );
    }

    try {
      await user.send({
        content: buildApplicantDmMessage(application, status),
        allowedMentions: { parse: [] }
      });
    } catch (error) {
      this.logger.warn("Could not DM application applicant:", error);
      return dmDeliveryResult(
        "DM not sent: applicant DMs may be closed.",
        "I could not DM the applicant. They may have DMs turned off."
      );
    }

    const userLabel = formatDiscordUser(user);
    return dmDeliveryResult(`DM sent to ${userLabel}.`, `DM sent to ${userLabel}.`);
  }

  async findApplicantUser({ application, interaction }) {
    const applicantInput = getApplicantDiscordInput(application);
    const guild = await resolveInteractionGuild(this.client, interaction);

    if (guild) {
      const member = await findGuildMemberByApplicantName(guild, applicantInput, this.logger);
      if (member?.user) {
        return member.user;
      }
    }

    const userId = extractDiscordUserId(applicantInput);
    if (!userId) {
      return null;
    }

    return this.client.users.fetch(userId).catch((error) => {
      this.logger.warn("Could not fetch applicant user for DM:", error);
      return null;
    });
  }

  getReviewConfig(application) {
    return this.applicationReviews[getApplicationType(application)] ?? this.applicationReviews.streamPartner;
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
  const status = application.status ?? "pending";
  const statusLabel = status.toUpperCase();
  const embed = new EmbedBuilder()
    .setColor(statusColors[status] ?? statusColors.pending)
    .setTitle(`${statusLabel}: ${getApplicationTypeLabel(application)} - ${getApplicantDiscordInput(application) || "Unknown"}`)
    .setDescription(buildApplicationDescription(application))
    .addFields(...getApplicationFields(application))
    .setTimestamp(new Date(application.createdAt));

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

function normalizeApplicationReviews({ applicationReviews, applicationsChannelId, acceptedRoleId }) {
  return {
    streamPartner: {
      channelId: applicationReviews.streamPartner?.channelId ?? applicationsChannelId ?? null,
      acceptedRoleId: applicationReviews.streamPartner?.acceptedRoleId ?? acceptedRoleId ?? null
    },
    staff: {
      channelId: applicationReviews.staff?.channelId ?? null,
      acceptedRoleId: applicationReviews.staff?.acceptedRoleId ?? null
    }
  };
}

function buildApplicationDescription(application) {
  if (getApplicationType(application) === applicationTypes.staff) {
    return [
      "Staff application review.",
      application.status === "pending" ? "Accepting this will assign the staff accepted role when configured." : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  const platformName = getPlatformName(application.channel?.platform);
  return [
    application.channel?.profileUrl ? `Channel: ${application.channel.profileUrl}` : null,
    application.channel?.platform ? `Platform: ${platformName}` : null,
    application.status === "pending" ? "Accepting this will add the channel to live notifications." : null
  ]
    .filter(Boolean)
    .join("\n");
}

function getApplicationFields(application) {
  const answers = application.answers ?? {};
  if (getApplicationType(application) === applicationTypes.staff) {
    return [
      field("Discord", answers.discordUsername, true),
      field("Timezone", answers.timezone, true),
      field("Age", answers.age, true),
      field("Active On Server", answers.activeOnServer),
      field("Why Staff", answers.whyStaff),
      field("Good Fit", answers.goodFit),
      field("Previous Staff Experience", answers.previousStaffExperience),
      field("Two Members Arguing", answers.arguingMembers),
      field("Player Breaking Rules", answers.ruleBreaker),
      field("Friend Broke A Rule", answers.friendRuleBreak),
      field("Staff Abuse", answers.staffAbuse),
      field("Hours Per Week", answers.hoursPerWeek, true),
      field("Understands Decline", labelChoice(answers.understandsDecline), true),
      answers.notes ? field("Notes", answers.notes) : null
    ].filter(Boolean);
  }

  return [
    field("Discord", answers.creatorName, true),
    field("Audience", answers.audienceSize, true),
    field("Content", answers.content),
    field("Promote Community", labelChoice(answers.promoteCommunity), true),
    field("Create With Partners", labelChoice(answers.collaborate), true),
    field("Events And Activities", labelChoice(answers.events), true),
    field("Future YouTube Videos/Events", labelChoice(answers.futureVideosEvents), true),
    answers.notes ? field("Notes", answers.notes) : null
  ].filter(Boolean);
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

async function resolveInteractionGuild(client, interaction) {
  if (interaction.guild) {
    return interaction.guild;
  }

  if (!interaction.guildId) {
    return null;
  }

  return client.guilds.fetch(interaction.guildId).catch(() => null);
}

export async function findGuildMemberByApplicantName(guild, applicantName, logger = console) {
  const userId = extractDiscordUserId(applicantName);
  if (userId) {
    return guild.members.fetch(userId).catch(() => null);
  }

  const query = getDiscordMemberSearchQuery(applicantName);
  const candidates = new Map();
  for (const member of guild.members.cache?.values?.() ?? []) {
    candidates.set(member.id, member);
  }

  if (query && typeof guild.members.search === "function") {
    try {
      const results = await guild.members.search({ query, limit: 10 });
      for (const member of results.values()) {
        candidates.set(member.id, member);
      }
    } catch (error) {
      logger.warn("Could not search guild members for accepted applicant:", error);
    }
  }

  return [...candidates.values()].find((member) =>
    memberMatchesApplicantName(member, applicantName)
  ) ?? null;
}

export function extractDiscordUserId(value) {
  const match = String(value ?? "")
    .trim()
    .match(/^(?:<@!?)?(\d{17,20})>?$/);
  return match?.[1] ?? null;
}

export function memberMatchesApplicantName(member, applicantName) {
  const target = normalizeDiscordName(applicantName);
  if (!target) {
    return false;
  }

  const user = member.user ?? {};
  return [
    user.id,
    user.username,
    user.tag,
    user.globalName,
    member.nickname,
    member.displayName
  ]
    .filter(Boolean)
    .some((value) => normalizeDiscordName(value) === target);
}

function getDiscordMemberSearchQuery(value) {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .split("#")[0]
    .trim()
    .slice(0, 100);
}

function normalizeDiscordName(value) {
  return String(value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

function roleAssignmentResult(reviewNote, replyNote) {
  return { reviewNote, replyNote };
}

function dmDeliveryResult(reviewNote, replyNote) {
  return { reviewNote, replyNote };
}

function formatDiscordUser(user) {
  const label = user.tag || user.username || "Discord user";
  return `${label} (${user.id})`;
}

function getApplicationsChannelEnvName(application) {
  return getApplicationType(application) === applicationTypes.staff
    ? "DISCORD_STAFF_APPLICATIONS_CHANNEL_ID"
    : "DISCORD_APPLICATIONS_CHANNEL_ID";
}

function getApplicationType(application) {
  return application?.type === applicationTypes.staff
    ? applicationTypes.staff
    : applicationTypes.streamPartner;
}

function getApplicationTypeLabel(application) {
  return getApplicationType(application) === applicationTypes.staff
    ? "Staff"
    : "Streamer Partner";
}

function getApplicantDiscordInput(application) {
  const answers = application.answers ?? {};
  return getApplicationType(application) === applicationTypes.staff
    ? answers.discordUsername
    : answers.creatorName;
}

function buildApplicantDmMessage(application, status) {
  const type = getApplicationType(application);
  if (status === "accepted" && type === applicationTypes.staff) {
    return [
      "**Stream Syndicate Staff Application Accepted**",
      "",
      "Congratulations. Your staff application has been accepted.",
      "",
      "Welcome to the staff team. Please check the server for your next steps, and thank you for being willing to help the community stay active, fair, and welcoming."
    ].join("\n");
  }

  if (status === "accepted") {
    return [
      "**Stream Syndicate Streamer Partner Application Accepted**",
      "",
      "Congratulations. Your streamer partner application has been accepted.",
      "",
      "Your channel has been added to live notifications, so future live streams can be announced in the server. Welcome to the partner program, and thank you for helping the community grow."
    ].join("\n");
  }

  if (type === applicationTypes.staff) {
    return [
      "**Stream Syndicate Staff Application Update**",
      "",
      "Thank you for applying to join the staff team. After reviewing your application, we are not able to accept it right now.",
      "",
      "You are welcome to apply again after 2 weeks. We appreciate your interest in helping the community."
    ].join("\n");
  }

  return [
    "**Stream Syndicate Streamer Partner Application Update**",
    "",
    "Thank you for applying to become a streamer partner. After reviewing your application, we are not able to accept it right now.",
    "",
    "You are welcome to apply again after 2 weeks. We appreciate your support and interest in growing with the community."
  ].join("\n");
}
