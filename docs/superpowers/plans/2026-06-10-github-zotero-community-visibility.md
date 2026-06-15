# GitHub Zotero Community Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Deepseek Copliot easy to discover from GitHub and the scraper-powered Zotero add-ons community by shipping a clean `v0.9.3` public release wave, submitting it to the community index, and publishing synchronized launch copy.

**Architecture:** Treat visibility as a release/distribution problem rather than a feature sprint. First add the missing GitHub release automation and GitHub-facing assets in this repo, then cut a new `v0.9.3` release instead of rewriting the existing `v0.9.2` tag, then submit the repo to `syt2/zotero-addons-scraper` and verify external discovery from the public feeds.

**Tech Stack:** GitHub Actions, GitHub Releases, Markdown, Zotero Plugin Scaffold, XPI packaging, scraper PR workflow

---

## Assumptions And Guardrails

- As of `2026-06-10`, origin already has tags `release`, `v0.9.0`, and `v0.9.2`.
- Do not delete or retag `v0.9.2`; use `v0.9.3` as the first visibility-focused public wave.
- Current local artifact contract already works: `.scaffold/build/Deepseek.Copliot-0.9.2.xpi`, `.scaffold/build/update.json`, and `.scaffold/build/update-beta.json`.
- Leave unrelated untracked files alone, including `Icon\r` and any user-owned plan docs.

## File Map

- Create: [.github/workflows/release.yml](/Users/Liang/project/agentpaper_zotero/.github/workflows/release.yml)
- Modify: [README.md](/Users/Liang/project/agentpaper_zotero/README.md)
- Modify: [CHANGELOG.md](/Users/Liang/project/agentpaper_zotero/CHANGELOG.md)
- Modify: [package.json](/Users/Liang/project/agentpaper_zotero/package.json)
- Create: [docs/community/launch-v0.9.3.md](/Users/Liang/project/agentpaper_zotero/docs/community/launch-v0.9.3.md)
- Create: [docs/community/assets/v0.9.3-reader-sidebar.png](/Users/Liang/project/agentpaper_zotero/docs/community/assets/v0.9.3-reader-sidebar.png)
- External fork file: `syt2/zotero-addons-scraper/addons/astro-koko@deepseek-copilot-for-zotero`

## Task 1: Add The Missing GitHub Release Automation

**Files:**
- Create: [.github/workflows/release.yml](/Users/Liang/project/agentpaper_zotero/.github/workflows/release.yml)

- [ ] Confirm the workflow is currently missing.

```bash
find .github -maxdepth 3 -type f
```

Expected:
- no `.github/workflows/release.yml`

- [ ] Create `.github/workflows/release.yml` with this exact content.

```yml
name: Release

on:
  push:
    tags:
      - v**

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  create-release:
    uses: zotero-plugin-dev/workflows/.github/workflows/release-plugin.yml@main
    with:
      build: "npm run build"
      release: "npm run release"
    secrets: inherit
```

- [ ] Verify the repo still produces the public release artifacts locally.

```bash
npm run build
npm run verify:xpi
```

Expected:
- `.scaffold/build/Deepseek.Copliot-0.9.2.xpi`
- `.scaffold/build/update.json`
- `.scaffold/build/update-beta.json`

- [ ] Commit only the workflow.

```bash
git add .github/workflows/release.yml
git commit -m "ci: add GitHub release workflow"
```

## Task 2: Turn The Repo Landing Page Into An Install-First Community Page

**Files:**
- Modify: [README.md](/Users/Liang/project/agentpaper_zotero/README.md)
- Create: [docs/community/launch-v0.9.3.md](/Users/Liang/project/agentpaper_zotero/docs/community/launch-v0.9.3.md)
- Create: [docs/community/assets/v0.9.3-reader-sidebar.png](/Users/Liang/project/agentpaper_zotero/docs/community/assets/v0.9.3-reader-sidebar.png)

- [ ] Replace the launch block at [README.md](/Users/Liang/project/agentpaper_zotero/README.md:1) with a shorter GitHub-first entry that includes badges, a direct install link, and the first screenshot.

```md
# Deepseek Copliot

[![Release](https://img.shields.io/github/v/release/astro-koko/deepseek-copilot-for-zotero?display_name=tag&style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases/latest)
[![Zotero](https://img.shields.io/badge/Zotero-9%20stable-CC2936?style=flat-square)](https://www.zotero.org/)
[![Install XPI](https://img.shields.io/badge/Install-XPI-2ea44f?style=flat-square)](https://github.com/astro-koko/deepseek-copilot-for-zotero/releases/latest)

把 DeepSeek 对话能力直接放进 Zotero 的原生阅读工作流里。

![Deepseek Copliot reader sidebar](docs/community/assets/v0.9.3-reader-sidebar.png)

`Deepseek Copliot` 面向“边读边问”的论文场景：你可以在文库里选中一篇论文后直接提问，在 PDF Reader 里选中文本后发起解释或追问，并按需开启联网查证，而不用在 Zotero、浏览器聊天页和临时笔记之间来回切换。

当前最新公开发布版本是 `v0.9.3`。安装方式是从 GitHub Releases 下载 `.xpi`，再在 Zotero 中使用 `Install Add-on From File...` 导入。
```

- [ ] Capture one clean packaged-install screenshot and save it to [docs/community/assets/v0.9.3-reader-sidebar.png](/Users/Liang/project/agentpaper_zotero/docs/community/assets/v0.9.3-reader-sidebar.png).

Capture rules:
- Zotero 9 stable
- native right sidebar visible
- one real paper selected
- no API keys, debug logs, private library names, or local filesystem paths visible

- [ ] Create [docs/community/launch-v0.9.3.md](/Users/Liang/project/agentpaper_zotero/docs/community/launch-v0.9.3.md) with this exact starting content.

```md
# Deepseek Copliot v0.9.3 Launch Pack

## GitHub Release Notes

Deepseek Copliot puts paper Q&A directly into Zotero's native Library and PDF Reader workflow.

### Highlights

- Native right-sidebar workflow for both Library and Reader
- Full-text ask flows for a single PDF or eligible single-paper item
- Optional web verification layered on top of local paper context
- Public GitHub XPI release pipeline for repeatable installs and upgrades

### Install

1. Download `Deepseek.Copliot-0.9.3.xpi` from this release.
2. Open `Tools -> Plugins` in Zotero.
3. Use the gear menu and choose `Install Add-on From File...`.
4. Restart Zotero.

### Notes

- Daily target: `Zotero 9 stable`
- Public release acceptance is based on the packaged `.xpi`, not proxy-mode `npm start`

## Scraper PR Body

Adds Deepseek Copliot to the scraper source.

- Repo: https://github.com/astro-koko/deepseek-copilot-for-zotero
- Latest stable release: v0.9.3
- Install asset: Deepseek.Copliot-0.9.3.xpi
- Tags: ai, reader

Why these tags:
- `ai`: DeepSeek-powered paper Q&A and explanation inside Zotero
- `reader`: native PDF Reader selection flows (`Explain` / `Ask...`) and sidebar reading workflow

## Zotero Forums Post

Title: Deepseek Copliot: native paper Q&A in the Library and PDF Reader

Body:

I just published `Deepseek Copliot`, a Zotero plugin that keeps paper Q&A inside Zotero's native reading workflow instead of sending you out to a separate web chat.

What it does:

- adds a native right-sidebar copilot in the Zotero Library
- lets you trigger `Explain` / `Ask...` from PDF Reader selections
- supports full-text asking for a single PDF or eligible single-paper item
- optionally adds web verification on top of the current paper context

Install:

- GitHub Releases: https://github.com/astro-koko/deepseek-copilot-for-zotero/releases/latest
- download the `.xpi`, then install it from `Tools -> Plugins -> Install Add-on From File...`

Current target:

- Zotero 9 stable

Published URLs:

- GitHub release:
- Scraper PR:
- Zotero Forums post:
```

- [ ] In GitHub repository settings, set these exact metadata values.

```text
Description:
Reading copilot for Zotero powered by the DeepSeek API and scoped to your local papers, PDFs, and collections.

Topics:
zotero
zotero-plugin
deepseek
ai-assistant
research-workflow
pdf-reader
```

- [ ] Commit the README and community launch assets.

```bash
git add README.md docs/community/launch-v0.9.3.md docs/community/assets/v0.9.3-reader-sidebar.png
git commit -m "docs: add GitHub-facing launch assets"
```

## Task 3: Cut `v0.9.3` As The First Visibility Release

**Files:**
- Modify: [package.json](/Users/Liang/project/agentpaper_zotero/package.json)
- Modify: [CHANGELOG.md](/Users/Liang/project/agentpaper_zotero/CHANGELOG.md)
- Modify: [README.md](/Users/Liang/project/agentpaper_zotero/README.md)

- [ ] Prepare honest `v0.9.3` copy before running the canonical release command.

Update the top of [CHANGELOG.md](/Users/Liang/project/agentpaper_zotero/CHANGELOG.md:1) to:

```md
## v0.9.3

- Added GitHub Actions release automation so future Zotero XPI releases publish consistently from tags.
- Polished the GitHub landing page with install-first community assets and release-facing copy.
- Prepared the community submission package for the scraper-powered Zotero add-ons ecosystem.
```

Update the version-facing copy in [README.md](/Users/Liang/project/agentpaper_zotero/README.md:7) so the public release references say `v0.9.3` instead of `v0.9.2`.

- [ ] Run the full public-release gate from this repo.

```bash
npm run check
```

Expected:
- tests pass
- build passes
- XPI verification passes

- [ ] Run the canonical release command and choose `0.9.3` when prompted.

```bash
npm run release
```

Expected:
- `package.json` version becomes `0.9.3`
- a release commit is created
- git tag `v0.9.3` is created
- commits and tag are pushed to `origin`

- [ ] If `npm run release` stops before the push, push the branch and tag explicitly.

```bash
git push origin HEAD
git push origin v0.9.3
git ls-remote --tags origin | rg "v0.9.3"
```

Expected:
- remote shows `refs/tags/v0.9.3`

- [ ] Verify the public asset URLs after GitHub Actions completes.

```bash
curl -I -L https://github.com/astro-koko/deepseek-copilot-for-zotero/releases/download/v0.9.3/Deepseek.Copliot-0.9.3.xpi
curl -I -L https://github.com/astro-koko/deepseek-copilot-for-zotero/releases/download/release/update.json
curl -I -L https://github.com/astro-koko/deepseek-copilot-for-zotero/releases/download/release/update-beta.json
```

Expected:
- final `200` response for all three URLs, with redirects allowed in the chain

- [ ] Do not rewrite `v0.9.2` even if it lacks assets; treat `v0.9.3` as the first fully automated public release wave.

## Task 4: Submit The Repo To The Scraper-Powered Zotero Add-Ons Index

**Files:**
- External fork file: `syt2/zotero-addons-scraper/addons/astro-koko@deepseek-copilot-for-zotero`
- Reuse: [docs/community/launch-v0.9.3.md](/Users/Liang/project/agentpaper_zotero/docs/community/launch-v0.9.3.md)

- [ ] Fork `syt2/zotero-addons-scraper` and create a working branch.

```bash
git clone git@github.com:<your-user>/zotero-addons-scraper.git
cd zotero-addons-scraper
git checkout -b add-deepseek-copilot-for-zotero
```

- [ ] Add the exact file `addons/astro-koko@deepseek-copilot-for-zotero` with this content.

```json
{"tags": ["ai", "reader"]}
```

- [ ] Commit and push the submission branch.

```bash
git add addons/astro-koko@deepseek-copilot-for-zotero
git commit -m "add astro-koko/deepseek-copilot-for-zotero"
git push origin add-deepseek-copilot-for-zotero
```

- [ ] Open a pull request with this exact title.

```text
Add astro-koko/deepseek-copilot-for-zotero
```

- [ ] Use this PR body.

```md
Adds Deepseek Copliot to the scraper source.

- Repo: https://github.com/astro-koko/deepseek-copilot-for-zotero
- Latest stable release: v0.9.3
- Install asset: Deepseek.Copliot-0.9.3.xpi
- Tags: ai, reader

Why these tags:
- `ai`: DeepSeek-powered paper Q&A and explanation inside Zotero
- `reader`: native PDF Reader selection flows (`Explain` / `Ask...`) and sidebar reading workflow
```

- [ ] After the PR merges, verify the published feed contains the repo.

```bash
curl -L https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos.json | rg "astro-koko|deepseek-copilot-for-zotero|Deepseek Copliot"
```

Expected:
- at least one published JSON entry for the repo

## Task 5: Publish The First Community Wave And Verify Discovery

**Files:**
- Reuse: [docs/community/launch-v0.9.3.md](/Users/Liang/project/agentpaper_zotero/docs/community/launch-v0.9.3.md)

- [ ] Publish the GitHub release notes from [docs/community/launch-v0.9.3.md](/Users/Liang/project/agentpaper_zotero/docs/community/launch-v0.9.3.md:1) onto the `v0.9.3` release page.

- [ ] Publish the Zotero Forums post using the forum copy from [docs/community/launch-v0.9.3.md](/Users/Liang/project/agentpaper_zotero/docs/community/launch-v0.9.3.md:1).

Launch checklist:
- include the GitHub release link
- include the screenshot
- mention `Zotero 9 stable` explicitly
- mention installation is via `.xpi`

- [ ] Verify these four discovery surfaces after launch.

```text
1. GitHub repo landing page shows install-first copy and the screenshot
2. GitHub /releases/latest resolves to Deepseek.Copliot-0.9.3.xpi
3. syt2/zotero-addons-scraper merged PR contains the repo
4. scraper publish feed includes the repo entry
```

- [ ] Record the final public URLs back into the `Published URLs` section of [docs/community/launch-v0.9.3.md](/Users/Liang/project/agentpaper_zotero/docs/community/launch-v0.9.3.md:1) so future release waves can reuse the trail.

## Success Criteria

- A new `v0.9.3` GitHub release exists with a downloadable XPI and working update manifests.
- The repo landing page is readable by Zotero users without opening the source tree.
- The plugin is accepted into `syt2/zotero-addons-scraper`.
- The release has at least one public Zotero community post and one discoverable GitHub release page.
- No existing public tag is rewritten or force-pushed.
