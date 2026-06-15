# Deepseek Copliot v0.9 Release Prep Design

## Status

Approved design for repository and release preparation only.

## Goal

Prepare the current project for a clean `0.9.0` GitHub-facing release candidate by improving versioning, repository hygiene, and public-facing documentation without re-scoping or bundling the current uncommitted feature work as part of the release.

## Scope

This pass covers:

- bumping the public project version from `0.8.0` to `0.9.0`
- aligning public-facing copy around the name `Deepseek Copliot`
- rewriting the root `README.md` so the project reads like a coherent public repository
- adding a `CHANGELOG.md` for the `0.9.0` release candidate
- adding contribution and GitHub collaboration scaffolding
- checking ignore rules and release-facing repository cleanliness
- documenting what this release prep includes and what it explicitly does not include

This pass does not cover:

- changing the Zotero add-on ID
- changing prefs prefixes, internal addon refs, or the upgrade path
- renaming internal implementation identifiers only for cosmetic consistency
- shipping or describing the current uncommitted feature changes as `0.9.0` features
- widening Zotero compatibility ranges
- introducing new product features, UI redesign, or runtime behavior changes unrelated to release prep

## Core Decision

Use a split identity model for this release candidate:

- public-facing name: `Deepseek Copliot`
- internal technical identity: keep the current historical add-on identifiers and config wiring unchanged

Reason:

- this achieves a cleaner GitHub-facing product surface immediately
- it avoids breaking install/upgrade assumptions before a packaged release smoke
- it keeps this work inside the user's requested boundary of release preparation rather than product migration

## Deliverables

### 1. Version and release metadata

Update release-facing metadata to `0.9.0` where doing so does not alter plugin identity semantics. The package version should become the canonical public version marker for this pass.

The release-facing copy should consistently describe the repo as preparing a `0.9.0` candidate rather than claiming that all in-progress local changes are already part of a finished release.

### 2. Public README rewrite

The root `README.md` should be rewritten to serve three audiences:

- a Zotero user deciding whether to install the plugin
- a developer trying to run or package it locally
- a collaborator preparing a GitHub issue or pull request

The README should include:

- concise product description
- current status and release posture
- key capabilities stated conservatively
- install path through GitHub Releases `.xpi`
- settings and API key expectations
- privacy and local-data boundaries
- local development and verification commands
- a short repository map
- contribution entry points

The README should avoid over-claiming features that depend on the user's current uncommitted worktree changes.

### 3. Changelog

Add `CHANGELOG.md` with an initial structured entry for `0.9.0`.

The `0.9.0` entry should describe this pass as release preparation and repository polish. It should explicitly avoid pretending that unpublished local feature work is already released.

It is acceptable for the changelog to frame earlier history briefly and conservatively if the repo does not yet have a formal historical release log.

### 4. Contribution scaffolding

Add lightweight collaboration files suitable for a public GitHub repo:

- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/pull_request_template.md`

These files should be practical rather than corporate. They should steer contributors toward:

- using packaged `.xpi` validation for release claims
- sharing Zotero version, plugin version, reproduction steps, and logs when reporting bugs
- keeping feature proposals scoped and user-facing

### 5. Release boundary documentation

Document the release boundary in public-facing docs:

- this repo is being prepared for `0.9.0`
- current in-progress local changes are not automatically part of `0.9.0`
- packaged artifact validation remains the acceptance gate for release confidence

This boundary can live in the README and changelog; it does not need a separate policy file unless the edits reveal a real gap.

## Files Expected To Change

Likely modifications:

- `package.json`
- `package-lock.json`
- `README.md`
- `.gitignore` if minor release-facing cleanup is justified

Likely additions:

- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/pull_request_template.md`

## Acceptance Criteria

The release prep is successful when:

1. the repository clearly presents itself as `Deepseek Copliot`
2. the public version is `0.9.0`
3. the README is polished enough for an outside GitHub visitor to understand install, scope, and status
4. the repo includes baseline contribution and issue/PR templates
5. release notes clearly separate repository prep from unreleased local feature work
6. no internal plugin identity changes are introduced as part of this pass

## Verification

Use the lightest loop that proves release-prep changes safely:

- inspect the resulting docs for naming and scope consistency
- run the relevant versioned metadata diff
- run the project verification commands that are appropriate for non-runtime release prep

Expected command set:

```bash
npm test
npm run build
npm run verify:xpi
```

If verification is blocked by pre-existing unrelated worktree changes or failures, document that clearly rather than masking it.

## Risks and Mitigations

### Risk: public name drifts from internal identifiers

Mitigation:

- keep the split explicit in docs
- avoid half-migrating technical IDs during this pass

### Risk: changelog accidentally claims unreleased work

Mitigation:

- describe `0.9.0` as release prep and repository polish
- avoid enumerating features that are only present in the current dirty worktree

### Risk: repository templates feel heavier than the project needs

Mitigation:

- keep templates short
- optimize for actionable bug reports and review-ready pull requests

## Implementation Notes

This work should be executed as repository preparation, not product refactoring. If any step starts to require add-on identity migration, version-compatibility widening, or feature-level release QA, stop and treat that as a separate project.
