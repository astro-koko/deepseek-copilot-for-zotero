import { describe, expect, it } from "vitest";

import {
  buildVerificationContext,
  findForbiddenArchiveEntries,
  findUnexpectedArchiveEntries,
} from "../../scripts/verify-build-artifact-lib.mjs";

const pkg = {
  version: "0.8.0",
  config: {
    addonName: "DS Copilot",
    addonRef: "zotero-ai-assistant",
  },
};

describe("build artifact verifier", () => {
  it("uses a release-safe xpi file name", () => {
    const context = buildVerificationContext({
      buildRoot: "/tmp/ds-copilot-build",
      pkg,
    });

    expect(context.xpiPath).toBe("/tmp/ds-copilot-build/DS.Copilot-0.8.0.xpi");
  });

  it("requires update.json for stable releases", () => {
    const context = buildVerificationContext({
      buildRoot: "/tmp/ds-copilot-build",
      pkg,
    });

    expect(context.requiredFiles).toContain("/tmp/ds-copilot-build/update.json");
    expect(context.requiredFiles).not.toContain(
      "/tmp/ds-copilot-build/update-beta.json",
    );
  });

  it("requires update-beta.json for prereleases", () => {
    const context = buildVerificationContext({
      buildRoot: "/tmp/ds-copilot-build",
      pkg: {
        ...pkg,
        version: "0.8.0-beta.1",
      },
    });

    expect(context.requiredFiles).toContain(
      "/tmp/ds-copilot-build/update-beta.json",
    );
    expect(context.requiredFiles).not.toContain("/tmp/ds-copilot-build/update.json");
  });

  it("flags forbidden profile and secret files inside the packaged archive", () => {
    expect(
      findForbiddenArchiveEntries([
        "bootstrap.js",
        "content/preferences.xhtml",
        ".env",
        "profile/cookies.sqlite",
        "content/data.db",
        "release-profile/places.sqlite",
      ]),
    ).toEqual([
      ".env",
      "profile/cookies.sqlite",
      "content/data.db",
      "release-profile/places.sqlite",
    ]);
  });

  it("rejects unexpected top-level archive entries outside the plugin payload", () => {
    expect(
      findUnexpectedArchiveEntries([
        "bootstrap.js",
        "content/preferences.xhtml",
        "locale/zh-CN/zotero-ai-assistant-preferences.ftl",
        "dev-data/zotero.sqlite",
        "README.md",
      ]),
    ).toEqual(["dev-data/zotero.sqlite", "README.md"]);
  });
});
