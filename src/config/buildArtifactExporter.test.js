import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildVisibleExportContext,
  exportVisibleBuildArtifacts,
  hasHiddenPathSegment,
  VISIBLE_XPI_EXPORT_DIR,
} from "../../scripts/export-build-artifact-lib.mjs";
import { buildVerificationContext } from "../../scripts/verify-build-artifact-lib.mjs";

const pkg = {
  version: "0.8.0",
  config: {
    addonName: "Deepseek Copliot",
    addonRef: "zotero-ai-assistant",
  },
};

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-copilot-export-"));
  tempDirs.push(dir);
  return dir;
}

describe("build artifact exporter", () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });

  it("uses a Finder-friendly visible XPI export directory", () => {
    const projectRoot = "/tmp/deepseek-copliot";
    const verification = buildVerificationContext({
      buildRoot: path.join(projectRoot, ".scaffold/build"),
      pkg,
      env: {},
    });
    const context = buildVisibleExportContext({ projectRoot, verification });

    expect(VISIBLE_XPI_EXPORT_DIR).toBe("build/xpi");
    expect(context.exportDir).toBe("/tmp/deepseek-copliot/build/xpi");
    expect(
      hasHiddenPathSegment(path.relative(projectRoot, context.exportDir)),
    ).toBe(false);
    expect(context.files.xpi.destination).toBe(
      "/tmp/deepseek-copliot/build/xpi/Deepseek.Copliot-0.8.0.xpi",
    );
  });

  it("copies verified artifacts into a clean visible folder", () => {
    const projectRoot = makeTempDir();
    const buildRoot = path.join(projectRoot, ".scaffold/build");
    const verification = buildVerificationContext({
      buildRoot,
      pkg,
      env: {
        DS_COPILOT_BUILD_CHANNEL: "dev",
        DS_COPILOT_DEV_NUMBER: "260615123",
      },
    });
    const context = buildVisibleExportContext({ projectRoot, verification });

    fs.mkdirSync(path.dirname(verification.xpiPath), { recursive: true });
    fs.writeFileSync(verification.xpiPath, "xpi");
    fs.writeFileSync(path.join(buildRoot, "update-beta.json"), "update");
    fs.mkdirSync(path.join(buildRoot, "addon"), { recursive: true });
    fs.writeFileSync(
      path.join(buildRoot, "addon/manifest.json"),
      '{"version_name":"0.8.0-dev.260615123"}',
    );
    fs.mkdirSync(context.exportDir, { recursive: true });
    fs.writeFileSync(path.join(context.exportDir, "stale.xpi"), "stale");

    const exported = exportVisibleBuildArtifacts(context);

    expect(exported.map((file) => path.basename(file))).toEqual([
      "Deepseek.Copliot-0.8.0-dev.260615123.xpi",
      "update-beta.json",
      "manifest.json",
    ]);
    expect(fs.existsSync(path.join(context.exportDir, "stale.xpi"))).toBe(
      false,
    );
    expect(
      fs.readFileSync(
        path.join(
          context.exportDir,
          "Deepseek.Copliot-0.8.0-dev.260615123.xpi",
        ),
        "utf8",
      ),
    ).toBe("xpi");
    expect(
      fs.readFileSync(path.join(context.exportDir, "update-beta.json"), "utf8"),
    ).toBe("update");
    expect(
      fs.readFileSync(path.join(context.exportDir, "manifest.json"), "utf8"),
    ).toContain("0.8.0-dev.260615123");
  });
});
