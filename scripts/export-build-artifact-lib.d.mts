export const VISIBLE_XPI_EXPORT_DIR: string;

export function hasHiddenPathSegment(pathValue: string): boolean;

export function buildVisibleExportContext(options: {
  projectRoot: string;
  verification: {
    xpiPath: string;
    addonVersion: {
      updateJsonName: string;
    };
  };
}): {
  exportDir: string;
  files: {
    xpi: { source: string; destination: string };
    updateManifest: { source: string; destination: string };
    manifest: { source: string; destination: string };
  };
};

export function exportVisibleBuildArtifacts(
  context: ReturnType<typeof buildVisibleExportContext>,
): string[];
