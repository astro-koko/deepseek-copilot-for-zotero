interface StartupDiagnosticArgs {
  addonID: string;
  detail?: string;
  stage: string;
  version: string;
}

export function buildStartupDiagnostic({
  addonID,
  detail,
  stage,
  version,
}: StartupDiagnosticArgs): string {
  return `[${addonID} v${version}] ${stage}${detail ? ` :: ${detail}` : ""}`;
}
