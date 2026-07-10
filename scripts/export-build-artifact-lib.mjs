import fs from "node:fs";
import path from "node:path";

export const VISIBLE_XPI_EXPORT_DIR = "build/xpi";

export function hasHiddenPathSegment(pathValue) {
  return pathValue
    .split(/[\\/]+/)
    .filter(Boolean)
    .some((segment) => segment.startsWith("."));
}

export function buildVisibleExportContext({ projectRoot, verification }) {
  const exportDir = path.join(projectRoot, VISIBLE_XPI_EXPORT_DIR);
  const buildRoot = path.dirname(verification.xpiPath);
  const xpiFileName = path.basename(verification.xpiPath);

  return {
    exportDir,
    files: {
      xpi: {
        source: verification.xpiPath,
        destination: path.join(exportDir, xpiFileName),
      },
      updateManifest: {
        source: path.join(buildRoot, verification.addonVersion.updateJsonName),
        destination: path.join(
          exportDir,
          verification.addonVersion.updateJsonName,
        ),
      },
      manifest: {
        source: path.join(buildRoot, "addon/manifest.json"),
        destination: path.join(exportDir, "manifest.json"),
      },
    },
  };
}

export function exportVisibleBuildArtifacts(context) {
  if (hasHiddenPathSegment(path.basename(context.exportDir))) {
    throw new Error(
      `Visible XPI export directory must not be hidden: ${context.exportDir}`,
    );
  }

  fs.rmSync(context.exportDir, { force: true, recursive: true });
  fs.mkdirSync(context.exportDir, { recursive: true });

  const exported = [];
  for (const file of Object.values(context.files)) {
    fs.copyFileSync(file.source, file.destination);
    exported.push(file.destination);
  }

  return exported;
}
