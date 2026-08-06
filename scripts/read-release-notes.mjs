import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };

const version = process.argv[2] || pkg.version;
const releaseNotePath = resolve(
  "docs/community/release-notes",
  `v${version}.md`,
);

if (!existsSync(releaseNotePath)) {
  throw new Error(
    `Missing Chinese release notes for v${version}: ${releaseNotePath}`,
  );
}

const releaseNotes = readFileSync(releaseNotePath, "utf8").trim();
if (!releaseNotes) {
  throw new Error(`Chinese release notes for v${version} are empty.`);
}

process.stdout.write(`${releaseNotes}\n`);
