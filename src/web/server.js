import express from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { projectRoot } from "../config.js";
import { validateApplicationForm } from "../services/applicationValidation.js";

const publicDir = path.join(projectRoot, "public");

export function createWebApp({ store, reviewService, logger = console }) {
  const app = express();
  app.set("trust proxy", 1);

  const submissionLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });

  app.disable("x-powered-by");
  app.use(express.json({ limit: "25kb" }));
  app.use(express.urlencoded({ extended: false, limit: "25kb" }));
  app.use(express.static(publicDir, { extensions: ["html"] }));

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/applications", submissionLimiter, async (req, res) => {
    const validation = validateApplicationForm(req.body);

    if (!validation.isValid) {
      res.status(400).json({ ok: false, errors: validation.errors });
      return;
    }

    try {
      const application = await store.createApplication({
        answers: validation.values,
        channel: validation.parsedChannel
      });
      await reviewService.sendApplicationReview(application);

      res.status(201).json({
        ok: true,
        applicationId: application.id,
        platform: validation.parsedChannel.platform,
        profileUrl: validation.parsedChannel.profileUrl
      });
    } catch (error) {
      logger.error("Application submission failed:", error);
      res.status(500).json({
        ok: false,
        errors: {
          form: getSubmissionErrorMessage(error)
        }
      });
    }
  });

  return app;
}

function getSubmissionErrorMessage(error) {
  if (error?.code === 50001 || error?.rawError?.code === 50001) {
    return "The bot cannot access the Discord applications channel yet. Please tell staff to check the bot's channel permissions.";
  }

  if (error?.code === 50013 || error?.rawError?.code === 50013) {
    return "The bot can see the Discord applications channel, but cannot send messages there yet. Please tell staff to check channel permissions.";
  }

  return "Could not send the application right now. Please try again soon.";
}

export function startWebServer({ config, store, reviewService, logger = console }) {
  const app = createWebApp({ store, reviewService, logger });

  return new Promise((resolve, reject) => {
    const server = app.listen(config.web.port, config.web.host, () => {
      logger.log(`Application website listening on ${config.web.publicBaseUrl}`);
      resolve(server);
    });

    server.on("error", reject);
  });
}
