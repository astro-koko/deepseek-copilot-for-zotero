# Zotero Sidebar Responsive Layout Contract

Status: Active regression contract  
Lane: `reader-host`  
Applies to: native Deepseek Copliot sidebars in both Library and PDF Reader

## User-visible invariant

The conversation panel must use the width Zotero currently gives it. A long
answer must continue to be readable when the native right pane is repeatedly
dragged wider and narrower; it must not retain an older wide layout and become
cut off on the right.

The contract applies to a newly opened PDF, a restored thread, and a streaming
answer. It covers Chinese text, long unbroken English text, lists, fenced code,
tables, and rendered math.

## Non-negotiable behavior

- Support normal, compact, and dense sidebar layouts at the real measured
  width. The current breakpoints are 360 px and 280 px; they are presentation
  breakpoints, never a minimum width imposed on Zotero.
- Allow the native section body, plugin mount, sidebar shell, viewport, thread,
  messages, and composer to shrink with `minWidth: 0`, bounded width, and
  border-box sizing. The plugin mount uses a shrinkable flex basis (`1 1 0`).
- Keep horizontal containment at the host and thread layers. Long prose uses
  CJK-safe wrapping; code and display math may provide their own horizontal
  scrollbar inside the block rather than escaping the conversation pane.
- Observe the actual sidebar root width. A width-only change must preserve the
  user's reading anchor after DOM layout settles; it must not unconditionally
  assign `scrollTop` to the newest message. Automatic follow is reserved for
  genuinely new or streaming output, and only when the user was already near
  the bottom before that output arrived.
- Keep the message viewport vertically scrollable and the composer/send
  controls reachable at every supported width.
- Keep document ownership separate from layout: an `A → B → A` PDF switch
  restores A's own history; a PDF without history opens the normal home/new
  conversation state. Never substitute unrelated global history.

## Code ownership

| Concern | Owner | Guard |
| --- | --- | --- |
| Native section body and plugin mount containment | `src/ui/ui.ts`, `src/ui/sidebarSection.ts` | `src/ui/ui.test.ts`, `src/ui/sidebarSection.test.ts` |
| Measured width, compact/dense layout, and scroll anchoring | `src/ui/components/Sidebar.tsx`, `src/ui/sidebarLayout.ts` | `src/ui/components/SidebarSource.test.ts`, `src/ui/sidebarLayout.test.ts` |
| Message, Markdown, code, table, and math containment | `src/ui/components/ThreadView.tsx` | `src/ui/components/ThreadView.test.tsx` |
| Scope-specific history on PDF switches | `src/ui/components/Sidebar.tsx`, session/thread services | `src/ui/components/sidebarViewModel.test.ts`, service tests |

## Required verification

Run the focused gate before broader work:

```bash
npm test -- src/ui/ui.test.ts src/ui/sidebarSection.test.ts src/ui/sidebarLayout.test.ts src/ui/components/SidebarSource.test.ts src/ui/components/ThreadView.test.tsx
```

Then run:

```bash
npm test
npm run build:dev:xpi
```

For real Zotero evidence, install the newest local dev XPI through the native
Plugins manager and prove its manifest version or hash before opening Settings,
Library, or Reader.

## Manual smoke matrix

| Surface | Scenario | Pass condition |
| --- | --- | --- |
| Library | Long answer while dragging approximately `350 → 280 → 260 px` | Text reflows; no right-edge clipping; composer remains reachable. |
| Library | `wide → narrow → wide → narrow` at the reading bottom | Reflow works on every transition without the visible conversation or composer drifting upward. |
| Library | Chinese, long English, list, code, table, and math | Prose wraps; structured blocks remain contained or scroll within themselves. |
| Reader | Repeat the long-answer resize cycle | Same containment and scroll behavior as Library. |
| Reader | `A → B → A` PDF tab switch | A restores A's own thread; B without history stays on the default state. |

On failure, record the installed XPI version/hash, surface, selected document,
whether the reply was streaming or restored, width-change sequence, and a
screenshot. Treat it as a host-layout regression; do not start provider
debugging until the install chain and native mount are proven.
