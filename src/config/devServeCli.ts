export function buildDevServeCommandForTest(): string {
  return [
    "import { Config, Serve } from 'zotero-plugin-scaffold';",
    "const ctx = await Config.loadConfig({});",
    "const server = new Serve(ctx);",
    "process.on('SIGINT', server.exit.bind(server));",
    "await server.run();",
  ].join("\n");
}

export function buildDevServeEvalArg(): string {
  return buildDevServeCommandForTest();
}
