import type { BuildAddonVersionMetadata } from "./build-version-lib.mjs";

export function buildVerificationContext(options: {
  buildRoot: string;
  pkg: {
    version: string;
    config: {
      addonName: string;
      addonRef: string;
    };
  };
  env?: Record<string, string | undefined>;
}): {
  xpiPath: string;
  addonVersion: BuildAddonVersionMetadata;
  requiredFiles: string[];
  requiredArchiveEntries: string[];
};

export function findMissingArchiveEntries(
  requiredEntries: string[],
  archiveEntries: string[],
): string[];

export function findForbiddenArchiveEntries(
  archiveEntries: string[],
): string[];

export function findUnexpectedArchiveEntries(
  archiveEntries: string[],
): string[];
