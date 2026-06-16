# Reader Session Isolation Lessons

This note captures the patterns and anti-patterns we learned while fixing
Deepseek Copliot's multi-PDF Reader behavior in Zotero.

It is a local reference summary, not copied product code.

## Problem Shape

The failure was not one bug but two linked failures:

1. conversation state was effectively global, so a send started in PDF A could
   interfere with the active state in PDF B
2. the Zotero Reader section could stay visually expanded while the plugin body
   was no longer mounted after tab switches

The user-visible symptom looked like:

- `Deepseek Copliot` header still present
- section sometimes still expanded
- body blank or missing
- history from another PDF missing or apparently replaced

## Root Cause We Confirmed Locally

### 1. Single active session state was too coarse

Our earlier session store tracked one active thread and one streaming state for
the whole app window. That is acceptable for a single-document flow but breaks
down when several Reader tabs stay open at once.

The fix that held up in tests and real smoke was:

- keep session state buckets per `scopeKey`
- keep abort controllers per `scopeKey`
- keep request version tracking per `scopeKey`
- switch the visible snapshot by active scope, without destroying other scopes

### 2. Reader tab switches can replace the body without reliably giving us a fresh render pass

The more subtle bug was host lifecycle behavior. On some Reader switches,
Zotero reported the section as still expanded, but the body we had rendered into
was no longer the active one. In practice, `onItemChange` could happen without a
follow-up render that re-mounted our React tree into the new body.

The fix that held up was:

- remember whether the user had expanded the Reader section
- restore that expansion state on later Reader item changes
- explicitly re-run Reader section body rendering from `onItemChange`

That last point matters. Restoring `open=true` alone is not enough if the new
body does not have the React host attached.

## Reference Patterns We Borrowed

We inspected:

- `reference/aidea-zotero/src/modules/contextPanel/index.ts`
- `reference/aidea-zotero/src/modules/contextPanel/contextResolution.ts`
- `reference/aidea-zotero/src/modules/contextPanel/readerPanel.ts`
- `reference/beaver-zotero/src/modules/readerIntegration.ts`

Borrowed patterns:

- prefer the panel's own Reader item context over a loose global active tab
- treat Reader tabs as isolated runtime scopes
- re-attach or re-resolve Reader UI state during tab changes instead of assuming
  one stable body

## Patterns We Explicitly Did Not Borrow

- no Beaver cloud thread model
- no Beaver account or backend assumptions
- no AIdea megafile architecture
- no toolbar-only fallback or ownership changes
- no replacing Zotero's official right-side pane surface

## What Worked In This Repo

### Session model

- `scopeKey`-bucketed chat session state
- non-destructive scope switches
- in-flight answer for PDF A can finish in the background while PDF B stays the
  visible active scope

### Reader host model

- store a per-window memory of whether the user opened the Reader section
- restore section expansion only after the user had opened it once
- force Reader body re-mount on `onItemChange` when the target is Reader

### Tests that mattered

The high-signal regressions were:

- keep an in-flight answer tied to its original document while switching scopes
- restore Reader section expansion across PDF tab switches
- re-mount Reader body on item change even if Zotero does not call render again

## Real Smoke Heuristics

When validating this area in Zotero, the fastest useful checks were:

1. open PDF A and confirm body is visible, not just the header
2. switch to PDF B and confirm B shows its own context and its own recent state
3. switch back to PDF A and confirm A history reappears

The specific failure class to watch for is:

- section header says expanded
- but `阅读器 · DeepSeek · 已就绪`, composer, or message list is missing

If that happens, treat it as a Reader host remount failure first, not a provider
or persistence problem.

## Recommended Future Smoke Path

Use at least two real PDFs with pre-existing messages:

- `AutoSOTA`
- `Absolute calibration strategies for the hydrogen epoch of reionization array...`

Minimal pass signal:

1. A visible body in PDF A
2. switch to PDF B without manually reopening the section
3. B body visible and scoped to B
4. switch back to A
5. A body visible and A history restored

Stronger pass signal:

1. repeat the same path after a cold Zotero restart
2. verify Add-ons entry still points to the packaged dev XPI version under test

## Practical Warning

Do not treat "section expanded" as equivalent to "plugin mounted".

In this bug class, those two states can drift apart.
