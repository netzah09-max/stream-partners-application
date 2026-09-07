import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JsonFileStore } from "./jsonStore.js";

test("recovers applications JSON when broken trailing data is present", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "discord-live-bot-"));
  const store = new JsonFileStore({ dataDir });
  const applicationsPath = path.join(dataDir, "applications.json");

  await fs.writeFile(
    applicationsPath,
    `${JSON.stringify(
      {
        version: 1,
        applications: [
          {
            id: "application-1",
            type: "staff",
            status: "pending",
            answers: { discordUsername: "StaffApplicant" },
            channel: null,
            createdAt: "2026-09-07T00:00:00.000Z",
            updatedAt: "2026-09-07T00:00:00.000Z"
          }
        ]
      },
      null,
      2
    )}\n\"broken\": true\n`,
    "utf8"
  );

  const applications = await store.getApplications();
  const backups = await fs.readdir(dataDir);

  assert.equal(applications.applications.length, 1);
  assert.equal(applications.applications[0].type, "staff");
  assert.ok(backups.some((name) => name.startsWith("applications.json.corrupt-")));

  await fs.rm(dataDir, { recursive: true, force: true });
});
