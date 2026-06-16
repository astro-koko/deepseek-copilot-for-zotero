export interface PrivacyCheckFile {
  fullPath: string;
  relativePath: string;
  name: string;
}

export type PrivacyCheckMode = "git-relevant" | "all-files";

export function collectGitRelevantFiles(root: string): PrivacyCheckFile[];

export function scanForbiddenFiles(files: PrivacyCheckFile[]): string[];

export function scanFileContents(files: PrivacyCheckFile[]): string[];

export function runPrivacyCheck(options?: {
  root?: string;
  mode?: PrivacyCheckMode;
}): string[];
