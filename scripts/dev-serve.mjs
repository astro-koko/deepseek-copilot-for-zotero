const mod = await import("zotero-plugin-scaffold");

const ctx = await mod.Config.loadConfig({});
const server = new mod.Serve(ctx);

process.on("SIGINT", server.exit.bind(server));

await server.run();
