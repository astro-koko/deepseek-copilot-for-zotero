# Zotero 7–10 Marketplace Release Handoff: v0.9.8

## Goal

Make one unified `Deepseek Copliot` release searchable on the Zotero Chinese plugin market page for Zotero 7, 8, 9, and 10:

- Pages: `https://zotero-chinese.com/plugins/#zotero=7`, `#zotero=8`, `#zotero=9`, and `#zotero=10`
- Search text: `Deepseek Copliot`
- Required public package for every supported Zotero target: `Deepseek.Copliot-0.9.8.xpi`

## Current repository state

This release is prepared as the single marketplace pickup build for Zotero 7 through Zotero 10:

- `package.json` version: `0.9.8`
- `addon/manifest.json` compatibility range: Zotero `7.0` through `10.*`
- Release artifact name after `npm run build:release:xpi`: `Deepseek.Copliot-0.9.8.xpi`

Local preflight on 2026-07-01 produced:

```text
617b87ccacf77bc6df3351beb2cd4f61d3716fd408ffc13c3ebeaaacd1e8d559  .scaffold/build/Deepseek.Copliot-0.9.8.xpi
582bb256189659aa289e8bbbca0819c298902be21c4bf906e36a68c489b85e39  .scaffold/build/update.json
```

These hashes are only for this local build output. Recompute them after the final CI/release build and use the CI-produced artifacts as the public release source of truth.

## Publish sequence

Run this from a clean working tree after the PR lands on the release branch:

```bash
npm ci
npm test
npm run build:release:xpi
jq '.version, .version_name, .applications.zotero' .scaffold/build/addon/manifest.json
sha256sum .scaffold/build/Deepseek.Copliot-0.9.8.xpi .scaffold/build/update.json
```

Expected manifest excerpt:

```json
{
  "strict_min_version": "7.0",
  "strict_max_version": "10.*"
}
```

Then publish the release tag:

```bash
git tag v0.9.8
git push origin v0.9.8
```

The repository release workflow should build and publish the GitHub release assets from the tag. Do not create separate Zotero 7/8/9 and Zotero 10 releases for this change; `v0.9.8` is the shared public version for all supported marketplace targets. Do not consider the marketplace goal complete until the public feed has refreshed for Zotero 7, 8, 9, and 10.

## Feed verification

After the GitHub release is public, run all target checks against the same `v0.9.8` release:

```bash
npm run marketplace:check -- --target 7
npm run marketplace:check -- --target 8
npm run marketplace:check -- --target 9
npm run marketplace:check -- --target 10
```

Pass condition:

```text
Marketplace feed contains astro-koko/deepseek-copilot-for-zotero for Zotero <7|8|9|10>: v0.9.8 (...)
```

If any command still reports `No checked marketplace feed contains ...`, wait for the scraper/feed refresh or inspect the `syt2/zotero-addons-scraper` run logs. The Zotero Chinese page cannot show the plugin under that `#zotero=` filter until its public feed contains a release entry for that target.

## Final acceptance check

Once all feed checks pass:

1. Open `https://zotero-chinese.com/plugins/#zotero=7`, `#zotero=8`, `#zotero=9`, and `#zotero=10`.
2. Search `Deepseek Copliot` on each filter.
3. Confirm the plugin card appears on each supported Zotero target.
4. Confirm every download points to the same `v0.9.8` XPI release asset.
