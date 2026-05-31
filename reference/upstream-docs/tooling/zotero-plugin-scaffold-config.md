# Zotero Plugin Scaffold Config Snapshot

Primary source:
- https://northword.github.io/zotero-plugin-scaffold/

Use this when:
- editing `zotero-plugin.config.ts`
- adjusting dev profile behavior, proxy mode, build asset inclusion, or update metadata
- comparing the current repo config with the standard template behavior

Current repo-specific use:
- dev-only preference preload for API key and model
- optional debugger flags gated behind `ZOTERO_DEBUGGER=1`
- XPI packaging remains the release acceptance path
