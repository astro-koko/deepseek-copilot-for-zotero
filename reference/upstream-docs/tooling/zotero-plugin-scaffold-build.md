# Zotero Plugin Scaffold Build Snapshot

Primary source:
- https://northword.github.io/zotero-plugin-scaffold/build.html

Use this when:
- you need the canonical build and packaging flow
- `npm start` behaves differently from packaged `.xpi`
- you are debugging placeholder replacement, preference generation, or artifact layout

Apply this doc to:
- [zotero-plugin.config.ts](/Users/Liang/project/agentpaper_zotero/zotero-plugin.config.ts)
- [scripts/verify-build-artifact.mjs](/Users/Liang/project/agentpaper_zotero/scripts/verify-build-artifact.mjs)
- `.scaffold/build/**`

Repo policy:
- proxy-mode hot reload is for iteration only
- packaged `.xpi` import is the acceptance gate
