# Agent Development Workflow

This workflow keeps issue work, specs, agent execution, and real Zotero evidence connected.

## Intake

Classify each issue before implementation:

- `bug`: requires reproduction steps, environment, expected behavior, actual behavior, and evidence.
- `feature`: requires a user workflow, non-goals, and acceptance criteria.
- `task`: requires a bounded file/module ownership section.
- `release-smoke`: requires a packaged XPI, clean-profile decision, and real Zotero evidence.

## Spec Gate

Write or update a spec when the change affects user workflow, release behavior, host surfaces, persistence, privacy, or provider contracts.

Use this structure:

```md
# <Change> Design

Status:
Owner:
Related issue:
Target release:

## Problem
## Goals
## Non-goals
## User Workflow
## Scope And Boundaries
## Design Decisions
## Files Expected To Change
## Acceptance Criteria
## Verification Plan
## Rollout Or Release Notes
## Risks And Mitigations
## Open Questions
```

Small local fixes can skip a full spec only when the issue already has clear acceptance criteria and verification.

## Plan Gate

Split work into tranches that an agent can finish without guessing:

- one owner per tranche
- explicit files or modules in scope
- explicit files or modules out of scope
- focused tests first
- broader tests after the focused path passes
- real Zotero smoke only after build and install-chain evidence are clean

Use [iteration-lanes.md](iteration-lanes.md) to pick a review lane before editing files.

For parallel agent work, keep write sets disjoint. Example:

- Agent A: version/build scripts and tests
- Agent B: GitHub issue and PR templates
- Agent C: real Zotero smoke runner design
- Agent D: documentation cleanup and release narrative

## Execution

Each implementation task should follow this loop:

1. Read the linked spec, plan, and nearest tests.
2. Add or update the smallest useful test.
3. Implement the change in the owned files only.
4. Run the focused test.
5. Run the broader gate that matches the risk.
6. Record commands and results on the issue or PR.

Do not mix install-chain, host-surface, and provider debugging. If Add-ons import is not proven, do not debug Reader or provider behavior yet.

## Project Skills

Local development may use project-specific Codex skills from `.codex/skills/`, but those files are optional local tooling rather than required public repo contents:

- `zotero-plugin-spec` for issues, specs, implementation plans, and multi-agent task splits.
- `zotero-real-smoke` for packaged XPI validation, real Zotero GUI smoke, and evidence review.
- `zotero-release-manager` for dev/release XPI builds, release assets, version narrative, and release gates.

Use these skills before generic planning when the task touches Zotero surfaces, XPI packaging, release behavior, or real smoke evidence.

When borrowing from reference projects, use [reference-adoption.md](reference-adoption.md) and state what is borrowed, what is explicitly not borrowed, and which local tests or real Zotero smoke evidence will verify the adaptation.

## Dev And Release Builds

Use dev-numbered packages for local packaged smoke:

```bash
npm run build:dev:xpi
```

This keeps `package.json` on the clean release version while producing an XPI named like `Deepseek.Copliot-0.9.4-dev.<number>.xpi`. The manifest uses a numeric `version` for Zotero compatibility and a descriptive `version_name` for the dev label.

Use the release path for final public artifacts:

```bash
npm run build:release:xpi
```

Formal release commits must not depend on a `-dev` package version.

Local `.env` credentials are allowed only for agent-run real GUI/provider smoke so the user does not need to type keys repeatedly. They must stay ignored, must not be packaged, and must not be used as product defaults. The normal user path remains entering credentials in Zotero Settings.

## Real Zotero Smoke

Treat real smoke as evidence collection, not improvisation.

Required evidence by layer:

- install chain: XPI path, hash, manifest version, Add-ons entry
- settings: pane visible, save/reopen, restart persistence
- library host: right-pane entry, regular item, PDF attachment item
- reader host: active PDF tab scope, two-tab switch, right-pane entry
- reader actions: `Explain`, `Ask...`, manual send
- provider: request marker, assistant response, error surfacing
- restart: repeated critical path after cold restart

Use the guardrails in [zotero-real-smoke-guardrails.md](zotero-real-smoke-guardrails.md): one control plane per micro-task, frontmost app checks before mutating GUI actions, and a two-strike stop rule.

## Closure

Before closing an issue or PR:

- update the plan checkbox or explain why it no longer applies
- update `CHANGELOG.md` when user-facing behavior changed
- update README when install, release, or public narrative changed
- attach test command results
- attach real Zotero smoke evidence when host or release behavior changed
- open follow-up issues for known gaps instead of burying them in prose
