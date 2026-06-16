import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import {
  runPrivacyCheck,
  scanForbiddenFiles,
  scanFileContents,
} from "../../scripts/privacy-check-lib.mjs";

const tempRoots = [];

function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ds-copilot-privacy-"));
  tempRoots.push(root);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: root,
  });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  return root;
}

function writeFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("privacy check", () => {
  it("ignores gitignored local .env files in the default git-relevant mode", () => {
    const root = makeTempRepo();
    writeFile(root, ".gitignore", ".env\n.scaffold/\n");
    writeFile(root, ".env", "DEEPSEEK_API_KEY=sk-test-local-ignored\n");
    writeFile(root, ".scaffold/profile/cookies.sqlite", "local");
    writeFile(root, "README.md", "No secrets here.");

    expect(runPrivacyCheck({ root })).toEqual([]);
  });

  it("still flags forbidden tracked or unignored files", () => {
    const root = makeTempRepo();
    writeFile(root, ".gitignore", ".env\n");
    writeFile(root, "secrets/client.pem", "not a real key\n");

    expect(runPrivacyCheck({ root })).toEqual([
      "forbidden file path: secrets/client.pem",
    ]);
  });

  it("can scan all files when an explicit full workspace audit is requested", () => {
    const root = makeTempRepo();
    writeFile(root, ".gitignore", ".env\n");
    writeFile(root, ".env", "DEEPSEEK_API_KEY=skRealSecretValue123456\n");

    expect(runPrivacyCheck({ root, mode: "all-files" })).toEqual([
      "forbidden file path: .env",
    ]);
  });

  it("keeps archive-style forbidden file checks available for direct file lists", () => {
    expect(
      scanForbiddenFiles([
        {
          fullPath: "/tmp/profile/cookies.sqlite",
          relativePath: "profile/cookies.sqlite",
          name: "cookies.sqlite",
        },
      ]),
    ).toEqual(["forbidden file path: profile/cookies.sqlite"]);
  });

  it("allows known fake test keys but flags real-looking tokens", () => {
    const root = makeTempRepo();
    const token = `Bearer ${"abcdefghijklmnopqrstuvwxyz1234"}`;
    writeFile(root, "src/example.ts", `const ok = "sk-test";\n${token}\n`);

    expect(
      scanFileContents([
        {
          fullPath: path.join(root, "src/example.ts"),
          relativePath: "src/example.ts",
          name: "example.ts",
        },
      ]),
    ).toEqual(["Bearer token in src/example.ts"]);
  });
});
