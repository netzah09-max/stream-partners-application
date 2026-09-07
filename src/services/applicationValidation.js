import { parseChannelLink } from "./channelLinks.js";

export const applicationTypes = {
  streamPartner: "streamPartner",
  staff: "staff"
};

const allowedChoices = new Set(["yes", "maybe", "no"]);
const yesNoChoices = new Set(["yes", "no"]);

export function validateApplicationForm(body, applicationType = applicationTypes.streamPartner) {
  if (applicationType === applicationTypes.staff) {
    return validateStaffApplicationForm(body);
  }

  return validateStreamPartnerApplicationForm(body);
}

export function validateStreamPartnerApplicationForm(body) {
  const values = {
    creatorName: clean(body.creatorName, 80),
    contact: clean(body.contact, 120),
    content: clean(body.content, 1000),
    channelLink: clean(body.channelLink, 400),
    audienceSize: clean(body.audienceSize, 300),
    promoteCommunity: clean(body.promoteCommunity, 20),
    collaborate: clean(body.collaborate, 20),
    events: clean(body.events, 20),
    futureVideosEvents: clean(body.futureVideosEvents, 20),
    notes: clean(body.notes, 1000),
    website: clean(body.website, 120)
  };
  const errors = {};

  if (values.website) {
    errors.form = "Submission could not be accepted.";
  }

  requireField(errors, values, "creatorName", "Discord username, mention, or user ID is required.");
  requireField(errors, values, "content", "Content answer is required.");
  requireField(errors, values, "channelLink", "Channel link is required.");
  requireField(errors, values, "audienceSize", "Audience size is required.");
  requireChoice(errors, values, "promoteCommunity", "Community promotion answer is required.");
  requireChoice(errors, values, "collaborate", "Partner content answer is required.");
  requireChoice(errors, values, "events", "Events answer is required.");
  requireChoice(errors, values, "futureVideosEvents", "Future YouTube videos/events answer is required.");

  let parsedChannel = null;
  if (values.channelLink) {
    try {
      parsedChannel = parseChannelLink(values.channelLink);
    } catch (error) {
      errors.channelLink = error.message;
    }
  }

  return {
    applicationType: applicationTypes.streamPartner,
    isValid: Object.keys(errors).length === 0,
    values,
    parsedChannel,
    errors
  };
}

export function validateStaffApplicationForm(body) {
  const values = {
    discordUsername: clean(body.discordUsername, 80),
    timezone: clean(body.timezone, 120),
    age: clean(body.age, 20),
    activeOnServer: clean(body.activeOnServer, 500),
    whyStaff: clean(body.whyStaff, 1000),
    goodFit: clean(body.goodFit, 1000),
    previousStaffExperience: clean(body.previousStaffExperience, 1000),
    arguingMembers: clean(body.arguingMembers, 1000),
    ruleBreaker: clean(body.ruleBreaker, 1000),
    friendRuleBreak: clean(body.friendRuleBreak, 1000),
    staffAbuse: clean(body.staffAbuse, 1000),
    hoursPerWeek: clean(body.hoursPerWeek, 80),
    understandsDecline: clean(body.understandsDecline, 20),
    notes: clean(body.notes, 1000),
    website: clean(body.website, 120)
  };
  const errors = {};

  if (values.website) {
    errors.form = "Submission could not be accepted.";
  }

  requireField(errors, values, "discordUsername", "Discord username, mention, or user ID is required.");
  requireField(errors, values, "timezone", "Timezone is required.");
  requireField(errors, values, "age", "Age is required.");
  requireField(errors, values, "activeOnServer", "Server activity answer is required.");
  requireField(errors, values, "whyStaff", "Staff motivation answer is required.");
  requireField(errors, values, "goodFit", "Staff fit answer is required.");
  requireField(errors, values, "previousStaffExperience", "Staff experience answer is required.");
  requireField(errors, values, "arguingMembers", "Argument scenario answer is required.");
  requireField(errors, values, "ruleBreaker", "Rule-break scenario answer is required.");
  requireField(errors, values, "friendRuleBreak", "Friend rule-break scenario answer is required.");
  requireField(errors, values, "staffAbuse", "Staff abuse scenario answer is required.");
  requireField(errors, values, "hoursPerWeek", "Weekly activity answer is required.");
  requireChoice(
    errors,
    values,
    "understandsDecline",
    "Decline understanding answer is required.",
    yesNoChoices
  );

  return {
    applicationType: applicationTypes.staff,
    isValid: Object.keys(errors).length === 0,
    values,
    parsedChannel: null,
    errors
  };
}

function clean(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function requireField(errors, values, name, message) {
  if (!values[name]) {
    errors[name] = message;
  }
}

function requireChoice(errors, values, name, message, choices = allowedChoices) {
  if (!choices.has(values[name])) {
    errors[name] = message;
  }
}
