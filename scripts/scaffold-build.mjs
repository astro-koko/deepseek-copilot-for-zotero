import { Build, Config } from "zotero-plugin-scaffold";

const ctx = await Config.loadConfig({});
const builder = new Build(ctx);

await builder.run();
