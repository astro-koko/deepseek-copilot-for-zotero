# Zotero AI Assistant: Product and Plugin Architecture Decision Spec

## Status: historical product spec

This spec remains useful for the broader product direction, but it is not the active execution spec for the current frontend stabilization push.

Use these files first for the current execution path:

- [2026-05-31-ds-copilot-host-first-frontend-design.md](/Users/Liang/project/agentpaper_zotero/docs/superpowers/specs/2026-05-31-ds-copilot-host-first-frontend-design.md)
- [2026-05-31-ds-copilot-host-first-frontend-task-board.md](/Users/Liang/project/agentpaper_zotero/docs/superpowers/plans/2026-05-31-ds-copilot-host-first-frontend-task-board.md)
- [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md)
- [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)

Current interpretation:

- host-first frontend stabilization is the immediate goal
- packaged `.xpi` plus restart is the real acceptance gate
- this older spec should not be treated as the top-level source of truth for current sequencing
Date: 2026-05-30
Status: Draft for review
Scope: Product design plus plugin architecture decisions

## 1. Purpose

This document defines the product shape and plugin architecture for Zotero AI Assistant.

The target is not "a general AI agent inside Zotero." The target is a Beaver-like, Zotero-native right sidebar that helps users ask questions about the paper they are reading without leaving Zotero.

This spec covers:

- Phase 1 MVP design in detail
- Phase 2 and Phase 3 as roadmap hypotheses only
- Product decisions
- UI decisions
- Plugin architecture boundaries

This spec does not include implementation steps or code-level task breakdown.

## 2. Product Thesis

The core problem is not that researchers lack access to language models. The core problem is workflow fragmentation.

Today, a common loop is:

1. Find a paper in Zotero
2. Open the PDF
3. Switch to ChatGPT or another site
4. Upload the file again
5. Ask questions
6. Switch back to Zotero

This breaks reading flow and forces the user to rebuild context manually.

Zotero AI Assistant should remove that loop by making AI feel like part of Zotero's reading surface.

## 3. Product Positioning

Phase 1 is an open-source, tool-style plugin:

- no required account
- no required cloud sync
- no subscription or credit system
- user supplies an OpenAI-compatible API endpoint, API key, and model

The product goal is not to outgrow Zotero. It is to reduce friction inside Zotero.

## 4. Scope Summary

### Phase 1: AI Reading Assistant

Phase 1 is the main focus of this spec.

It supports:

- one native right-side AI panel
- the panel available in both Zotero library view and PDF reader view
- one continuous conversation thread shared across both surfaces
- automatic loading of the current PDF as context in reader view
- automatic loading of the currently selected item in library view
- manual context controls on top of automatic context
- single-paper Q&A and reading support
- Beaver-like homepage, shell, and interaction style
- local persistence of thread history

It does not support:

- required login
- remote profile state
- remote library sync
- credits or plan logic
- multi-agent research workflows
- complex RAG or vector database infrastructure
- true multi-paper comparative analysis as a core Phase 1 capability

### Phase 2: Multi-Paper Analysis

Roadmap hypothesis only.

Potential additions:

- multiple selected papers as explicit context
- structured compare/synthesize actions
- support for "what differs across these papers?" workflows

### Phase 3: Workflow Enhancements

Roadmap hypothesis only.

Potential additions:

- external literature search
- OpenAlex, arXiv, ADS, Semantic Scholar integrations
- broader review and discovery workflows

## 5. Decision Summary

### Decision 1: Use Beaver as the primary UI reference

The sidebar shell, homepage structure, and in-Zotero interaction style should closely follow Beaver.

Reason:

- Beaver already solves the hardest UX problem correctly: AI lives inside the Zotero reading workflow.
- Re-inventing the layout adds design risk without improving the core user outcome.
- The right move is subtractive adaptation, not fresh invention.

### Decision 2: Copy Beaver's Zotero-native interaction model, not Beaver's cloud product model

Keep:

- right sidebar shell
- visible context chips
- history and new thread affordances
- selection-triggered questioning from the reader
- reader/library dual-surface integration

Remove in Phase 1:

- account registration and login
- sync state, profile state, credits, plans
- remote research-agent orchestration
- cloud-coupled discovery features

Reason:

- the user wants a Beaver-like experience without Beaver's SaaS dependency model
- the PRD's first validation target is workflow fit, not service monetization

### Decision 3: Support both library and reader surfaces from the start

The same assistant must be available in:

- Zotero library view
- Zotero PDF reader view

Reason:

- the user explicitly wants both
- Zotero work begins in library and deepens in reader
- this preserves the Beaver-like "always available in the current surface" feel

### Decision 4: Share one continuous thread across library and reader

Switching surfaces does not switch to a separate assistant.

Reason:

- this preserves continuity
- it makes the assistant feel like one tool rather than two panels
- recent chats remain meaningful across surfaces

### Decision 5: Default to automatic full-PDF context in reader view

When a user is in the PDF reader, the current PDF is auto-loaded by default. The user may still manually add or pin context.

Reason:

- this directly replaces the "upload PDF elsewhere" workflow
- it reduces friction to near zero
- the user explicitly requested automatic loading with optional manual control

### Decision 6: Keep Phase 1 as a single-paper assistant even if the shell looks broader

Library view is supported, but Phase 1 should not pretend to be a full-library intelligent agent.

Reason:

- single-paper reading assistance is the true MVP
- multi-paper analysis belongs to the next phase
- over-promising at the UI layer will create product debt and implementation debt

## 6. Competitive and Design Rationale

### Why Beaver's right sidebar model is correct

Beaver's codebase shows that the assistant is mounted directly into Zotero's native item pane and context pane, with dedicated handling for standard and stacked layouts. It also routes reader selection and annotation actions into the sidebar flow and treats the separate window as secondary.

Implication:

- the correct pattern is to integrate with Zotero's native panel surfaces
- a floating-first design would fight the host application's layout and user workflow

### Why a floating window should not be the main pattern

A floating window breaks the most important property of the product: the AI should live next to the paper while the user is reading.

Floating windows may still exist later as a convenience surface, but they should not define the core interaction.

### Why NotebookLM is not the right plugin template

NotebookLM is a project-level synthesis workspace. Its center of gravity is a notebook built from uploaded or collected sources, not the live reading surface of a current PDF.

Implication:

- NotebookLM is a valid reference for future synthesis workflows
- it is not the correct Phase 1 interaction model for a Zotero-native reading assistant

### Why ChatPDF is only a partial template

ChatPDF is close to the paper-Q&A problem, but its workflow is still upload-first and chat-first rather than Zotero-first.

Implication:

- it validates demand for paper conversation
- it does not solve the native Zotero workflow problem by itself

### Why Humata is not the right Phase 1 shape

Humata is oriented toward asking across files and file collections. That is closer to corpus QA than to page-level reading assistance.

Implication:

- useful as a later reference for broader library workflows
- not the right center for the first version

## 7. User Workflow Model

### Library workflow

The user is in Zotero's main library view.

Expected behavior:

- the assistant can open in the right sidebar
- if one item is selected, that item becomes the current automatic context
- if no item is selected, show a clear empty state
- if many items are selected, do not fake deep comparative support in Phase 1

The library surface is valid, but its role in Phase 1 is still bounded by single-paper assistance.

### Reader workflow

The user is reading a PDF.

Expected behavior:

- the assistant opens in the right sidebar
- the current PDF is auto-loaded as context
- a reader selection may be added automatically as a high-priority local context
- the user can ask freeform questions or use suggested actions

This is the product's primary workflow.

### Cross-surface continuity

The user may begin in library view and continue in reader view, or the reverse.

Expected behavior:

- the same thread remains visible
- context chips update to show the current automatic context
- context changes are visible, not silent

## 8. UX Specification

### 8.1 Overall UI direction

The plugin should closely follow Beaver's sidebar structure.

Use Beaver as a baseline for:

- homepage composition
- header affordances
- large central input area
- visible current-context chips
- suggested actions section
- recent chats section

The design rule is:

- preserve the shell
- remove cloud scaffolding
- rewrite text and controls to match actual Phase 1 capability

### 8.2 Header

Phase 1 header should preserve the Beaver-like structure, but trim cloud-specific elements.

Keep:

- close panel
- chat history
- new thread
- settings

Optional for later, not required in Phase 1:

- separate window affordance

Remove:

- account and plan-related logic
- sync or reconnect indicators
- credit and profile status logic

### 8.3 Homepage

The homepage should remain visually very close to Beaver.

Structure:

- headline: Beaver-like "How can I help you?" style
- large composer
- current context chip row
- suggested actions section
- recent chats section

The homepage should feel familiar to Beaver users, but it must only advertise real Phase 1 capabilities.

### 8.4 Composer

The composer is the most important control in the product.

It should support:

- a large text input area
- current context chip
- selection chip in reader when a selection exists
- manual add-context affordance
- send action

Phase 1 composer content rules:

- reader view defaults to current PDF
- library view defaults to current selected item
- user can manually pin or add context

### 8.5 Visible context model

Context cannot be hidden or silently swapped.

The UI must always show current automatic context, such as:

- current paper
- current file
- selection page
- manually attached context

If the user moves from one paper to another, the chip row must update immediately.

### 8.6 Suggested actions

Retain Beaver's "Actions for Current File" pattern, but narrow the action set to real Phase 1 use cases.

Initial action examples:

- Summarize this paper
- Extract key findings
- Explain this section
- What are the limitations?

Do not include actions that imply advanced cloud workflows the product does not actually support.

### 8.7 Recent chats

Retain the recent chats block.

Reason:

- it reinforces the single shared-assistant mental model
- it supports the cross-surface thread design
- it lowers re-entry friction

## 9. Conversation and Context Model

### 9.1 One thread, many context snapshots

The user sees one continuous thread.

Internally, each message turn stores a context snapshot.

Each snapshot should capture at least:

- surface: library or reader
- current item ID
- current attachment/PDF ID if present
- page number if known
- active selection if present
- auto-loaded context set
- manually pinned or added context set

This prevents hidden context drift while preserving a unified thread.

### 9.2 Automatic vs manual context

Context sources are split into two categories:

- auto context
- manual context

Auto context:

- injected from current surface state

Manual context:

- explicitly added or pinned by the user

This allows Phase 1 to be effortless by default while still giving control.

### 9.3 Reader context rules

In reader view:

- auto-load the current PDF
- if a text selection exists, treat it as high-priority local context
- allow the user to pin current paper or selection

### 9.4 Library context rules

In library view:

- if exactly one item is selected, use it as automatic context
- if no item is selected, show a clear empty state
- if multiple items are selected, show a bounded Phase 1 message rather than pretending full multi-paper support exists

### 9.5 Prompt composition order

Recommended prompt assembly order:

1. user question
2. current automatic metadata context
3. current PDF full text
4. current selection
5. manual pinned or attached context

This keeps the system anchored to the paper the user is actively handling.

## 10. Plugin Architecture

### 10.1 Architecture principles

Phase 1 should preserve Beaver-like UX while staying much thinner technically.

Architecture principles:

- UI can be Beaver-like
- product scope must stay narrower than Beaver
- no Beaver-managed cloud dependency is required beyond the user's chosen model API
- modules should remain swappable and locally understandable

### 10.2 Recommended module boundaries

#### Panel Shell

Responsibilities:

- mount the Beaver-style panel into Zotero library and reader surfaces
- own structural layout and shell-level state
- switch surface-specific presentation while preserving one assistant identity

#### Context Resolver

Responsibilities:

- detect current library selection
- detect current reader attachment, page, and selection
- emit automatic context state for the current turn

#### Document Context Loader

Responsibilities:

- load current PDF content
- cache or stage document text as needed
- serve selected passages and full-text context to the prompt layer

#### Conversation Store

Responsibilities:

- persist threads locally
- persist per-turn context snapshots
- serve recent chats and history views

#### Prompt Composer

Responsibilities:

- assemble model requests from user message plus resolved context
- apply action templates
- encode context order and system guidance

#### Model Gateway

Responsibilities:

- connect to OpenAI-compatible APIs
- stream responses
- normalize transport and error handling

#### Action Layer

Responsibilities:

- provide Beaver-like suggested actions
- map actions to prompt templates
- remain intentionally simple in Phase 1

#### Settings Layer

Responsibilities:

- store API base URL
- store API key
- store model choice
- store small behavior preferences

### 10.3 Deliberately excluded architecture in Phase 1

Do not treat these as required:

- account system
- cloud sync layer
- plan and credit state
- vector database
- advanced retrieval backend
- remote search orchestration
- general agent framework

## 11. Why Not Build the Full Beaver Minus Cloud in Phase 1

Even if the UI is close to Beaver, the first version should not attempt to preserve all of Beaver's deeper capabilities.

Reason:

- the product must first prove that a Zotero-native reading assistant reduces context switching
- most Phase 1 value comes from contextual placement, not backend sophistication
- plugin engineering complexity is already high without adding advanced retrieval or orchestration

The right strategy is:

- copy the working shell
- narrow the capability scope
- validate usage
- expand only after the core loop proves itself

## 12. Roadmap Constraints for Phase 2 and Phase 3

Future phases should be enabled by the architecture, but not prematurely implemented in Phase 1.

Design constraints to preserve now:

- context snapshots must be able to reference more than one source later
- action templates must be able to grow into compare/synthesis actions
- conversation typing may later distinguish single-paper and multi-paper threads

No stronger commitment is made in this spec.

## 13. Success Criteria

Phase 1 succeeds if users can do most single-paper Q&A inside Zotero without leaving the app.

Primary signs of success:

- users keep the sidebar available during reading
- users stop repeatedly switching to external chat tools for current-paper questions
- users can ask about current papers with near-zero setup friction
- users understand current context because it is visible in the UI

## 14. Risks and Mitigations

### Risk: UI promises too much

Mitigation:

- only keep Beaver elements that match real Phase 1 capability
- rewrite labels and empty states carefully

### Risk: Shared thread causes context drift

Mitigation:

- store per-turn context snapshots
- display visible context chips
- distinguish auto and manual context

### Risk: Dual-surface support creates too much complexity

Mitigation:

- keep both surfaces on the same shell and same conversation model
- allow only surface-specific context resolution to differ

### Risk: Plugin complexity overwhelms model work

Mitigation:

- keep architecture modular
- avoid premature cloud, sync, and advanced retrieval features

## 15. Final Product Statement

Zotero AI Assistant Phase 1 should be a Beaver-inspired, Zotero-native reading assistant with a nearly Beaver-like sidebar shell, but stripped of Beaver's cloud product scaffolding and constrained to a thinner single-paper assistance scope.

The product should feel familiar to users of Beaver while remaining faithful to the original PRD:

- AI lives inside Zotero
- current paper context is automatic
- reading flow is preserved
- complexity is controlled

## 16. Workspace Note

This workspace is currently not a git repository, so this spec can be written here but cannot be committed from the current directory until the project is placed under git.
