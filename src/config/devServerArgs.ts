export function buildDevServerStartArgs(
  debuggerEnabled: boolean | string | undefined,
): string[] {
  const startArgs = ["-no-remote"];

  if (debuggerEnabled === true || debuggerEnabled === "1") {
    startArgs.push("-ZoteroDebugText", "-jsdebugger");
  }

  return startArgs;
}
