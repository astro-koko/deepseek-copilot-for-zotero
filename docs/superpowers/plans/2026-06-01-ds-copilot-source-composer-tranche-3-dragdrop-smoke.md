# Deepseek Copliot Source Composer Tranche 3 Drag And Drop And Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Zotero-native drag and drop for papers, annotations, and collections, then prove the complete researcher flow in packaged XPI smoke.

**Architecture:** Parse drag payloads in a pure service before touching React. `ComposerDropZone` translates validated payloads into existing message-source store actions and presents one short inline error state. Delivery follows the repo workbench: logic loop, host loop, packaged XPI loop.

**Tech Stack:** React 18, TypeScript, Vitest, Zotero drag MIME payloads, Zotero packaged XPI verification

---

### Task 1: Parse Zotero Drag Payloads

**Files:**
- Create: `src/services/zoteroDropPayload.ts`
- Create: `src/services/zoteroDropPayload.test.ts`

- [ ] **Step 1: Write failing parser tests**

```ts
it("parses dragged Zotero item ids", () => {
  expect(parseZoteroDropPayload(fakeTransfer({
    "zotero/item": "7,8",
  }))).toEqual({ kind: "items", itemIds: [7, 8] });
});

it("parses dragged annotations", () => {
  expect(parseZoteroDropPayload(fakeTransfer({
    "zotero/annotation": JSON.stringify([{ id: 9 }]),
  }))).toEqual({ kind: "annotations", itemIds: [9] });
});

it("rejects unsupported payloads", () => {
  expect(parseZoteroDropPayload(fakeTransfer({ "text/plain": "hello" })))
    .toEqual({ kind: "error", message: "Drop Zotero papers, annotations, or collections here." });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run src/services/zoteroDropPayload.test.ts
```

Expected: FAIL because parser does not exist.

- [ ] **Step 3: Implement parser**

Create:

```ts
export type ZoteroDropPayload =
  | { kind: "items"; itemIds: number[] }
  | { kind: "annotations"; itemIds: number[] }
  | { kind: "collections"; collectionIds: number[] }
  | { kind: "error"; message: string };

export function parseZoteroDropPayload(
  transfer: Pick<DataTransfer, "getData" | "types">,
): ZoteroDropPayload
```

Use MIME precedence:

```text
zotero/annotation
zotero/item
zotero/collection
```

Reject invalid JSON, empty IDs, and more than 10 dropped objects with explicit
messages.

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run src/services/zoteroDropPayload.test.ts
git add src/services/zoteroDropPayload.ts src/services/zoteroDropPayload.test.ts
git commit -m "feat: parse zotero source drag payloads"
```

### Task 2: Add Composer Drop Zone

**Files:**
- Create: `src/ui/components/ComposerDropZone.tsx`
- Modify: `src/ui/components/Composer.tsx`

- [ ] **Step 1: Add the drop-zone component**

Create `ComposerDropZone.tsx` with:

```ts
interface ComposerDropZoneProps {
  children: React.ReactNode;
  onAddCollection: (source: CollectionSourceReference) => void;
  onAddItem: (source: ItemSourceReference) => void;
}
```

Use `parseZoteroDropPayload()` on drag-over and drop. Resolve live items with
`Zotero.Items.get(id)`, resolve collections with `Zotero.Collections.get(id)`,
and reuse `itemToSource()` from `sourceSearch.ts`.

Render:

```tsx
<div onDragOver={handleDragOver} onDrop={handleDrop}>
  {isDragging && <div>Drop sources to add them</div>}
  {error && <div role="alert">{error}</div>}
  {children}
</div>
```

Clear errors after one second using `ownerDocument.defaultView?.setTimeout()`
with a global-timer fallback.

- [ ] **Step 2: Wrap the composer**

Wrap the source chips, textarea, and footer in `ComposerDropZone`. Call the
existing `messageSourcesStore.addItem()` and `.addCollection()` actions.

- [ ] **Step 3: Run build and commit**

```bash
npm run build
git add src/ui/components/ComposerDropZone.tsx src/ui/components/Composer.tsx
git commit -m "feat: add zotero source drag and drop"
```

### Task 3: Run Complete Logic And Host Loops

**Files:**
- Update: `docs/zotero-dev-smoke-checklist.md`

- [ ] **Step 1: Run full preflight**

```bash
npm run check
```

Expected: Vitest, TypeScript build, and XPI artifact verification all PASS.

- [ ] **Step 2: Run daily-profile host smoke**

Record PASS/FAIL:

```text
Current Paper auto-load
Current File auto-load
+ menu add/remove
@ item search
note and annotation add
library, collection, and tag filters
Flash -> Pro -> Flash switching
paper drag
annotation drag
collection drag
unsupported drag inline error
successful send clears temporary evidence
pre-response failure retains draft and temporary evidence
```

- [ ] **Step 3: Commit host evidence**

```bash
git add docs/zotero-dev-smoke-checklist.md
git commit -m "test: verify beaver-style source composer host flow"
```

### Task 4: Run Packaged XPI Acceptance

**Files:**
- Update: `docs/zotero-dev-smoke-checklist.md`

- [ ] **Step 1: Invoke release smoke workflow**

Use the `zotero-plugin-release-smoke` skill and run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 2: Install the packaged XPI**

Install:

```text
.scaffold/build/Deepseek Copliot-0.1.0.xpi
```

through Zotero's Add-ons manager. Do not hand-edit `extensions.json`.

- [ ] **Step 3: Restart Zotero and rerun critical checks**

Record PASS/FAIL:

```text
Add-ons entry present after restart
Settings pane present
Library native host stable
Reader native host stable
Current File visible
add one paper source
switch to DeepSeek Pro
send one real request
temporary paper clears after acceptance
```

- [ ] **Step 4: Commit packaged acceptance evidence**

```bash
git add docs/zotero-dev-smoke-checklist.md
git commit -m "test: record packaged source composer acceptance"
```
