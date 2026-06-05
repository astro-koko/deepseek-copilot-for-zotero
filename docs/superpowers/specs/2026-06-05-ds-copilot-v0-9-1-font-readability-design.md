# DS Copilot v0.9.1 Font Readability Design

## Status

Approved design for a small readability-focused UI pass.

## Goal

Ship `v0.9.1` as a narrow, user-visible polish release that makes DS Copilot's default font sizing feel slightly more readable across the Zotero sidebar surfaces without introducing a new settings control or a separate plugin-specific font scaling system.

## Context

User feedback indicates that the current DS Copilot UI reads slightly too small in daily use.

The current frontend uses many hard-coded `10px`, `11px`, and `12px` font sizes across sidebar, composer, message rendering, and support surfaces. This creates two problems:

- the default reading experience feels cramped
- future font-related adjustments would require touching many disconnected literals again

Zotero itself already treats font size as a host-level concern:

- the official knowledge base documents `View -> Font Size` and `View -> Note Font Size`
- hidden preferences include `extensions.zotero.fontSize` and `note.fontSize`

Other Zotero plugins also tend to either follow Zotero's host-level controls or expose narrowly scoped font sizing only for a distinct reading surface, rather than building a broad parallel scaling system for all plugin UI.

This suggests that the right move for this pass is to improve the DS Copilot default sizing while keeping the interaction model simple and host-friendly.

## Scope

This pass covers:

- slightly increasing DS Copilot's default font sizes across the primary sidebar experience
- consolidating repeated font-size literals into a small shared set of size tiers where practical
- adjusting supporting line-height and spacing where needed so the larger text still feels calm
- bumping the project version from `0.9.0` to `0.9.1`

This pass does not cover:

- adding a user-facing `Small / Medium / Large` font setting
- wiring DS Copilot directly to Zotero's global font-size preference values
- a broader visual redesign
- changing copy, prompts, or feature behavior unrelated to readability
- changing Zotero native preferences pane typography unless a DS Copilot-owned custom element is clearly too small

## Core Decision

Use a default-only readability uplift for `v0.9.1`.

That means:

- DS Copilot becomes slightly easier to read out of the box
- the plugin does not add another settings decision for the user
- the implementation prepares the codebase for a future font-size option if user demand continues

This is preferred over adding a new setting now because:

- the user request is for a small default increase
- Zotero already has an existing mental model for global font changes
- the current codebase will benefit more from style consolidation than from another preference surface

## Design

### 1. Target surfaces

Adjust DS Copilot-owned text on the surfaces that make up the main daily reading loop:

- sidebar header and metadata
- current scope summary
- notices and badges
- recent thread list and thread actions
- empty state copy
- composer textarea, helper text, and preset UI
- thread message rendering, including markdown headings, lists, tables, and code blocks
- selection popup buttons and any DS Copilot-owned inline labels that still read too small

Do not treat the Zotero native preferences pane controls as the primary target for this pass. Those controls already inherit host styling and are not the main source of the readability complaint.

### 2. Typography strategy

Avoid a blanket mechanical `+1px` across every literal. Instead, move the UI one step toward a more readable hierarchy:

- primary body text should generally move from `12px` to `13px`
- common secondary text should generally move from `11px` to `12px`
- tiny uppercase or badge-style labels should generally move from `10px` to `11px`
- heading levels in rendered markdown should shift up together so hierarchy stays intact

Where text size increases, line-height should remain generous enough for dense academic content. Tight button rows and compact badges may also need minor padding adjustments so the UI does not feel cramped.

### 3. Code structure

Where the current files use repeated inline font-size literals, introduce a lightweight shared size vocabulary instead of continuing to hard-code one-off values everywhere.

This can stay intentionally small, for example:

- `xs`
- `sm`
- `md`
- `lg`

The goal is not a full design-token framework. The goal is to reduce repeated magic numbers in the DS Copilot surfaces that are being adjusted now.

The likely implementation center is the React UI layer:

- `src/ui/components/Sidebar.tsx`
- `src/ui/components/Composer.tsx`
- `src/ui/components/ThreadView.tsx`
- `src/ui/components/EmptyState.tsx`
- `src/ui/components/ScopeBar.tsx`

Secondary review targets:

- `addon/content/styles.css`
- `src/modules/readerIntegration.ts`
- `src/ui/ui.ts` if any legacy DS Copilot-controlled sizing there still affects the shipped experience

### 4. Versioning

This work is part of `v0.9.1`.

The public package version should move from `0.9.0` to `0.9.1`, and any release-facing metadata derived from `package.json` should continue to resolve correctly through the existing release build pipeline.

## Files Expected To Change

Likely modifications:

- `package.json`
- `package-lock.json`
- `src/ui/components/Sidebar.tsx`
- `src/ui/components/Composer.tsx`
- `src/ui/components/ThreadView.tsx`
- `src/ui/components/EmptyState.tsx`
- `src/ui/components/ScopeBar.tsx`
- `addon/content/styles.css`

Possible modifications:

- `src/modules/readerIntegration.ts`
- relevant UI tests that assert style output or rendered structure

## Acceptance Criteria

The `v0.9.1` readability pass is successful when:

1. DS Copilot feels slightly easier to read by default in both library and reader sidebar contexts
2. primary body text, secondary metadata, and tiny labels each move up consistently enough that the UI feels intentionally sized rather than patched
3. no major truncation, overlap, or visibly cramped controls appear after the size increase
4. markdown message rendering still preserves clear heading hierarchy and readable tables/code blocks
5. no new font-size preference UI is added
6. the project version is `0.9.1`

## Verification

Use a focused verification loop for this pass:

```bash
npm test
npm run build
```

If versioning or artifact naming changes touch release-facing packaging paths, also run:

```bash
npm run verify:xpi
```

Manual verification should confirm:

- library sidebar appearance
- reader sidebar appearance
- empty state
- recent thread list
- active thread with markdown content
- composer and slash preset UI
- any DS Copilot-owned selection popup elements that still use very small text

## Risks and Mitigations

### Risk: text becomes larger but hierarchy becomes muddy

Mitigation:

- raise related tiers together instead of changing isolated literals
- keep headings and metadata visually separated through size and weight

### Risk: larger text causes cramped controls in narrow sidebars

Mitigation:

- adjust line-height and padding alongside font-size changes
- verify on both library and reader mounts

### Risk: the pass fixes today's complaint but leaves the codebase hard to tune later

Mitigation:

- consolidate repeated font sizes into a minimal shared vocabulary while touching the affected files

## Implementation Notes

This should remain a small polish release. If the work starts to imply a fully configurable typography system, direct syncing with Zotero global font preferences, or a broader sidebar redesign, stop and treat that as a separate project after `v0.9.1`.
