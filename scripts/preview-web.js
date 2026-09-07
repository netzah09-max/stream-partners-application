import "dotenv/config";
import path from "node:path";
import { projectRoot, resolveProjectPath } from "../src/config.js";
import { JsonFileStore } from "../src/storage/jsonStore.js";
import { startWebServer } from "../src/web/server.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST?.trim() || "0.0.0.0";
const publicBaseUrl = process.env.PUBLIC_BASE_URL?.trim() || `http://localhost:${port}`;
const dataDir = process.env.PREVIEW_DATA_DIR?.trim()
  ? resolveProjectPath(process.env.PREVIEW_DATA_DIR)
  : path.join(projectRoot, "data-preview");
const store = new JsonFileStore({ dataDir });

const reviewService = {
  async sendApplicationReview(application) {
    console.log(
      `Preview accepted application submission ${application.id}; no Discord message was sent.`
    );
  }
};

await startWebServer({
  config: {
    web: {
      host,
      port,
      publicBaseUrl
    }
  },
  store,
  reviewService
});
