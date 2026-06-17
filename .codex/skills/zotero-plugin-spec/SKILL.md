---
name: zotero-plugin-spec
description: Use when planning or revising a Deepseek Copliot/Zotero plugin feature, bug fix, issue, implementation plan, or multi-agent task that affects Zotero surfaces, settings, Reader handoff, scope/context behavior, persistence, provider requests, or release behavior.
---

# Zotero Plugin Spec

Use this skill to turn a request into a concrete spec, issue, or agent task plan for this repository.

## Required Reads

Read these first:

- `AGENTS.md`
- `docs/agent-dev-workflow.md`
- `docs/zotero-dev-workbench.md`
- `docs/zotero-doc-index.md`
- `docs/reference-adoption.md`

Read only the relevant reference path:

- build/release/package: `reference/upstream-docs/tooling/`
- Reader/sidebar/lifecycle: `reference/beaver-zotero/`
- architecture documentation: `reference/aidea-zotero/doc/ARCHITECTURE_CN.md`
- agent/test gates: `reference/llm-for-zotero/`

## Spec Checklist

Every Zotero plugin spec must state:

- classification: `bug`, `feature`, `task`, or `release-smoke`
- affected Zotero surface: Add-ons, Settings, Library, Reader, Reader popup/menu, provider, persistence, release
- user workflow and non-goals
- files or modules expected to change
- privacy boundary: API keys, local prefs, profile data, thread history, databases
- reference adoption gate when using reference projects: borrow, do not borrow, local verification
- acceptance criteria
- automated verification commands
- whether packaged `.xpi` smoke is required
- real Zotero evidence needed

## Output Shape

For a spec:

```md
# <Change> Design

Status:
Owner:
Related issue:
Target release:

## Classification
## Problem
## Goals
## Non-goals
## User Workflow
## Scope And Boundaries
## Design Decisions
## Files Expected To Change
## Acceptance Criteria
## Verification Plan
## Real Zotero Smoke
## Reference Adoption
## Risks And Mitigations
## Open Questions
```

For a multi-agent plan:

- Explorer tasks: read-only, distinct questions
- Worker tasks: disjoint write scopes
- Reviewer tasks: test/smoke/risk review
- stop conditions and evidence required

Require a spec gate for public behavior, host surface, privacy, release, or persistence changes. Small fixes may skip a full spec only when acceptance criteria and verification are already clear.

Do not propose provider or product expansion until the host/release acceptance path is clear. Do not copy from reference projects directly; extract patterns and adapt them to this repo's smaller architecture.
