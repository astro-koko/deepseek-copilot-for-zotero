import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import pkg from "../package.json" with { type: "json" };
import {
  buildVerificationContext,
  findForbiddenArchiveEntries,
  findMissingArchiveEntries,
  findUnexpectedArchiveEntries,
} from "./verify-build-artifact-lib.mjs";

const buildRoot = path.resolve(".scaffold/build");
const verification = buildVerificationContext({ buildRoot, pkg });

const missing = verification.requiredFiles.filter(
  (file) => !fs.existsSync(file),
);

if (missing.length > 0) {
  console.error("Missing packaged addon artifacts:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

let archiveEntries = [];
try {
  archiveEntries = execFileSync("unzip", ["-Z1", verification.xpiPath], {
    encoding: "utf8",
  })
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
} catch (error) {
  console.error(
    `Failed to inspect packaged addon archive: ${verification.xpiPath}`,
  );
  if (error instanceof Error && error.message) {
    console.error(error.message);
  }
  process.exit(1);
}

const missingArchiveEntries = findMissingArchiveEntries(
  verification.requiredArchiveEntries,
  archiveEntries,
);
const forbiddenArchiveEntries = findForbiddenArchiveEntries(archiveEntries);
const unexpectedArchiveEntries = findUnexpectedArchiveEntries(archiveEntries);

if (
  missingArchiveEntries.length > 0 ||
  forbiddenArchiveEntries.length > 0 ||
  unexpectedArchiveEntries.length > 0
) {
  console.error("Packaged addon archive failed verification:");

  if (missingArchiveEntries.length > 0) {
    console.error("Missing required archive entries:");
    for (const entry of missingArchiveEntries) {
      console.error(`- ${entry}`);
    }
  }

  if (forbiddenArchiveEntries.length > 0) {
    console.error("Forbidden archive entries:");
    for (const entry of forbiddenArchiveEntries) {
      console.error(`- ${entry}`);
    }
  }

  if (unexpectedArchiveEntries.length > 0) {
    console.error("Unexpected top-level archive entries:");
    for (const entry of unexpectedArchiveEntries) {
      console.error(`- ${entry}`);
    }
  }

  process.exit(1);
}

console.log("Packaged addon artifacts verified.");
