# Deepseek Copliot Sidebar Host-Tone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Deepseek Copliot sidebar so it reads like a native Zotero right-pane tool surface instead of a standalone web assistant page.

**Architecture:** Keep the existing host wiring, state model, and send flow intact. Constrain the work to presentational components plus the sidebar view-model copy so the sidebar becomes denser, quieter, and structurally closer to Zotero while preserving the current logic contracts.

**Tech Stack:** React 18, TypeScript, Vitest, inline component styles, Zotero plugin host UI

---

### Task 1: Tighten the view-model copy contract

**Files:**
- Modify: `src/ui/components/sidebarViewModel.ts`
- Test: `src/ui/components/sidebarViewModel.test.ts`

- [ ] **Step 1: Write the failing test**

Add or update assertions in `src/ui/components/sidebarViewModel.test.ts` to require shorter, tool-like copy for the main shell states:

```ts
expect(model.heroTitle).toBe("Select an item");
expect(model.heroBody).toContain("Choose one paper");
expect(model.noticeTitle).toBe("Configuration required");
expect(model.heroTitle).toBe("Ready to chat");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/components/sidebarViewModel.test.ts`
Expected: FAIL because the current titles/bodies still use the longer card-style copy.

- [ ] **Step 3: Write minimal implementation**

Update `buildSidebarViewModel()` in `src/ui/components/sidebarViewModel.ts` so the empty, config-error, unsupported-scope, home, and thread states use shorter operational titles and body text without changing any state logic or visibility flags.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/components/sidebarViewModel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/sidebarViewModel.ts src/ui/components/sidebarViewModel.test.ts
git commit -m "refactor: tighten sidebar shell copy"
```

### Task 2: Convert the sidebar shell from card-heavy layout to compact pane sections

**Files:**
- Modify: `src/ui/components/Sidebar.tsx`
- Test: `src/ui/components/sidebarViewModel.test.ts`

- [ ] **Step 1: Write the failing test**

Add a structure-facing assertion in `src/ui/components/sidebarViewModel.test.ts` for the lighter shell expectations that the component will reflect:

```ts
expect(model.providerLabel).toBe("DeepSeek");
expect(model.statusLabel).toBe("Ready");
expect(model.showSuggestedActions).toBe(true);
```

Then add a manual checklist comment in the test file for the new compact section layout to guard against reintroducing hero-card wording.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/components/sidebarViewModel.test.ts`
Expected: FAIL on the new copy/layout-adjacent assertions if they depend on updated wording from Task 1.

- [ ] **Step 3: Write minimal implementation**

In `src/ui/components/Sidebar.tsx`, keep the same rendered sections and handlers but:

- replace the current branded header styling with a compact title row
- reduce toolbar emphasis
- convert `scopeCard`, `heroCard`, `sectionCard`, `threadViewWrap`, `noticeCard`, `streamingCard`, and `errorCard` to neutral pane sections
- restyle suggested actions and recent chats as compact stacked rows
- keep all click handlers and visibility logic unchanged

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/components/sidebarViewModel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/Sidebar.tsx src/ui/components/sidebarViewModel.test.ts
git commit -m "refactor: restyle sidebar as pane sections"
```

### Task 3: Restyle thread messages and composer to match the host surface

**Files:**
- Modify: `src/ui/components/ThreadView.tsx`
- Modify: `src/ui/components/Composer.tsx`
- Test: `src/ui/components/sidebarViewModel.test.ts`

- [ ] **Step 1: Write the failing test**

Add or update one assertion in `src/ui/components/sidebarViewModel.test.ts` that depends on the revised, shorter composer-facing language:

```ts
expect(model.composerPlaceholder).toContain("Ask about this");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/components/sidebarViewModel.test.ts`
Expected: FAIL if the current placeholder/copy has not yet been updated to the new shell tone.

- [ ] **Step 3: Write minimal implementation**

In `src/ui/components/ThreadView.tsx` and `src/ui/components/Composer.tsx`:

- remove the strong blue chat-app treatment
- move to quieter borders, lighter fills, smaller radii, and denser spacing
- reduce textarea height and slash-menu shadow/emphasis
- keep submit/cancel/preset behavior unchanged

If needed, align any placeholder wording in `sidebarViewModel.ts` with the updated tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/components/sidebarViewModel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/ThreadView.tsx src/ui/components/Composer.tsx src/ui/components/sidebarViewModel.ts src/ui/components/sidebarViewModel.test.ts
git commit -m "refactor: quiet sidebar thread and composer styling"
```

### Task 4: Verify the focused sidebar regression suite

**Files:**
- Modify: `docs/superpowers/specs/2026-06-01-ds-copilot-sidebar-host-tone-design.md`
- Modify: `docs/superpowers/plans/2026-06-01-ds-copilot-sidebar-host-tone-plan.md`

- [ ] **Step 1: Run the focused sidebar and host-related tests**

Run:

```bash
npx vitest run src/ui/components/sidebarViewModel.test.ts src/ui/sidebarSection.test.ts src/ui/sidebarRuntime.test.ts src/ui/ui.test.ts
```

Expected: PASS

- [ ] **Step 2: Run the broader chat/session guardrail tests that must remain green**

Run:

```bash
npx vitest run src/services/chatSession.test.ts src/services/persistence.test.ts src/modules/preferencesPane.test.ts src/modules/preferencesPaneSource.test.ts src/ui/components/sidebarViewModel.test.ts src/services/settingsManager.test.ts src/services/chatEngine.test.ts
```

Expected: PASS

- [ ] **Step 3: Review the diff against the design**

Check that the final UI pass only touched presentational/sidebar copy files and did not modify host lifecycle or send/persistence logic.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-01-ds-copilot-sidebar-host-tone-design.md docs/superpowers/plans/2026-06-01-ds-copilot-sidebar-host-tone-plan.md
git commit -m "docs: capture sidebar host-tone plan"
```

