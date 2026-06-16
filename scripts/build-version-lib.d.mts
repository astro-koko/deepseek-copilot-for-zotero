export interface BuildAddonVersionMetadataOptions {
  baseVersion: string;
  env?: Record<string, string | undefined>;
}

export interface BuildAddonVersionMetadata {
  channel: "release" | "prerelease" | "dev";
  displayVersion: string;
  manifestVersion: string;
  xpiVersion: string;
  updateJsonName: "update.json" | "update-beta.json";
  isPrerelease: boolean;
}

export function buildAddonVersionMetadata(
  options: BuildAddonVersionMetadataOptions,
): BuildAddonVersionMetadata;
