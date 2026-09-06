import { parseChannelLink } from "./channelLinks.js";

const allowedChoices = new Set(["yes", "maybe", "no"]);

export function validateApplicationForm(body) {
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

  requireField(errors, values, "creatorName", "Name or Discord username is required.");
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
    isValid: Object.keys(errors).length === 0,
    values,
    parsedChannel,
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

function requireChoice(errors, values, name, message) {
  if (!allowedChoices.has(values[name])) {
    errors[name] = message;
  }
}
