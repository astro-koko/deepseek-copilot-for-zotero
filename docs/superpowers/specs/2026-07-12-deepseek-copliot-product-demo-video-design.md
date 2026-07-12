# Deepseek Copliot Product Demo Video Design

Status: Proposed, awaiting review
Owner: Product and video production
Related issue: Product introduction video
Target release: 1-minute product demo for Bilibili and Xiaohongshu

## Problem

New graduate students who read papers in Zotero may be interested in AI assistance but hesitate when setup looks opaque or the product appears to be a generic chat window. The product needs a short, credible demonstration of its actual Zotero-native workflow: configuration guidance, in-context questions from the Reader sidebar, reusable slash commands, and whole-paper interpretation.

Existing personal-library recordings are unsuitable as source material because titles, notes, items, conversation history, and document content make the screen visually noisy and may expose private material.

## Goals

- Produce a 55-59 second, 16:9 horizontal product demo suitable for Bilibili and Xiaohongshu.
- Make the software functions, not abstract AI claims, the center of every scene.
- Establish that the plugin is designed for Zotero paper reading and has a low-friction configuration path.
- Demonstrate selection-to-sidebar questioning, slash commands, and a whole-paper reading workflow.
- Use smooth, restrained motion to guide attention without obscuring the genuine product UI.
- Provide an AI voice-over script aligned to the final shot timing.

## Non-goals

- Do not create a full installation tutorial, feature inventory, comparison video, or benchmark of model quality.
- Do not show personal library data, API keys, chat history, real account information, or an uncontrolled desktop.
- Do not make unverified claims that all model inference is free. The supported claim is that the plugin is free to use; model-provider billing remains determined by the user's API configuration.
- Do not replace the product UI with a fictional AI-generated interface.

## Audience

The primary audience is graduate students who are new to structured research workflows but frequently read papers, especially English-language papers. They need confidence that the tool can be configured without a detour and will remain useful during ordinary close reading.

## User Workflow

1. Viewer recognizes the friction of facing a dense English paper.
2. Viewer sees configuration guidance and relevant provider links presented in the Zotero plugin settings.
3. Viewer sees the plugin available in Zotero's native Reader right sidebar.
4. Viewer sees a selected passage become a contextual sidebar question and a readable explanation.
5. Viewer sees recurring reading tasks available as slash commands.
6. Viewer sees one command turn the current paper into a structured whole-paper interpretation.
7. Viewer receives a concise call to action naming the product and its free plugin availability.

## Creative Direction

Use a continuous first-person research-reading flow rather than isolated screens or a competing-product comparison. The hook is: "Reading papers should not begin by learning complicated setup." The promise is: "Guidance and useful reading actions are already in Zotero where the paper is open."

The visual language is calm and software-native:

- The Zotero interface owns the frame.
- Motion is limited to 1.12x-1.35x focal zooms, subtle dimming outside the active control, cursor movement, and short text callouts.
- Each feature change is connected through the same paper, keeping the mental model continuous.
- Captions use high-contrast Chinese text with no more than two lines at a time.
- Decorative transitions, floating generic AI imagery, and an oversized marketing hero are excluded.

## Storyboard And Voice-over

| Time | Product visual | On-screen copy | AI voice-over |
| --- | --- | --- | --- |
| 0-4s | A clean academic PDF opens in Zotero Reader; a difficult sentence is in view. | 读论文，别先被配置劝退 | "读论文，最难的有时不是论文，而是开始前那一串配置。" |
| 4-11s | Plugin settings page: configuration guidance and provider links are individually focused. | 配置有引导，链接直接可达 | "Deepseek Copliot 把配置引导和相关入口整理在 Zotero 里，跟着做就能开始。" |
| 11-18s | A safe mock configuration is completed; success state transitions back to Reader. No key is shown. | 几步完成，回到阅读 | "完成必要设置后，你不需要离开文献库。" |
| 18-30s | A sentence is selected in the Reader. The native right sidebar opens, receives the passage context, and the user asks for an explanation. | 画词提问，就在侧边栏 | "遇到读不懂的句子，划选以后就在侧边栏继续问。上下文跟着当前论文走。" |
| 30-39s | A structured reply appears; method, logic, and terminology are visually emphasized. | 方法、逻辑、术语，逐层讲清 | "它把复杂的表达拆成你真正需要理解的方法、逻辑和术语。" |
| 39-48s | The composer receives `/`; command menu reveals a small set: summary, explain, method breakdown, research limitations. One command is selected. | 常用问题，一条命令 | "总结、解释、方法拆解、研究局限，这些常用问题已经准备成快捷命令。" |
| 48-54s | The selected command produces a compact structured whole-paper interpretation. | 从一句话，到整篇论文 | "从一句话，到一整篇论文，都能在同一个阅读流程里推进。" |
| 54-59s | Product name and actual Zotero right sidebar remain visible; clean CTA appears. | Deepseek Copliot<br>免费使用的 Zotero AI 阅读助手 | "Deepseek Copliot，免费使用的 Zotero AI 阅读助手。" |

## Asset Strategy

### Clean Demonstration Profile

Create a dedicated local demo profile and a dedicated Zotero data directory. It must not reuse the personal library, development profile, release-smoke profile, cookie store, or existing Deepseek Copliot conversation data.

The recording library contains only:

- one or two open-access or author-created demonstration PDFs;
- synthetic, neutral metadata and collections;
- a small number of carefully named items;
- intentionally created demonstration questions and answers with no personal data.

API keys are never recorded. The configuration scene uses masked input or a deliberate local mock state. If a real provider response is used for recording, a temporary key is entered manually only after the rest of the profile is prepared, then removed after capture.

### AI-Assisted Polish

AI-generated images may be used only as supporting presentation assets: a clean title background, a subtle paper thumbnail replacement, or a fully synthetic document preview. They must never represent an actual Deepseek Copliot screen or imply an unimplemented feature.

For product screens, use real clean-profile captures. Remotion may crop, magnify, mask sensitive regions, recreate cursor movement, normalize colours, and add captions/callouts. It must not change feature controls, generate plausible-but-false responses, or conceal material UI failures.

### Recording Requirements

- Record each feature as a separate clean clip at 1920x1080, with predictable window size and no desktop notifications.
- Capture the native right-side pane in Reader, not a top-toolbar-only surface.
- Keep each raw interaction 2-5 seconds longer than the final cut to leave room for easing.
- Use a stable Chinese UI locale for all captures and captions.

## Production Architecture

Remotion is the deterministic finishing layer. It imports clean screen recordings and renders the final 1920x1080 composition with captions, callouts, zooms, cursor path overlays, audio sync, and timing-safe transitions.

ChatCut is the editorial assistance layer. It creates the initial assembly from numbered clips and the approved voice-over script, generates an initial AI narration take, and helps locate natural cut points. The final video timing and visual treatment remain authored in Remotion so product UI callouts are reproducible.

The production inputs are:

1. clean-profile screen captures;
2. the approved voice-over audio, with a calm, credible Mandarin voice;
3. a caption sheet matched to narration phrases;
4. optional supporting bitmap assets that have passed the AI-polish boundary above.

## Scope And Boundaries

In scope:

- product message, final script, shot list, recording checklist, and video project;
- separate local demo profile setup;
- capture and compositing of actual plugin UI;
- AI voice-over and captions.

Out of scope:

- changing plugin code, branding, package metadata, or production release behavior;
- capturing or modifying the user's real library;
- implying that a provider's API calls are universally free;
- publishing the video or creating external accounts.

## Acceptance Criteria

- Final duration is between 55 and 59 seconds.
- Output is 1920x1080, 16:9, and readable without sound via Chinese captions.
- The four planned product proofs appear clearly: configuration guidance, sidebar selection question, slash commands, whole-paper interpretation.
- At least 80% of the visible duration is actual plugin/Zotero UI or tightly cropped detail from it.
- No personal data, raw API key, private chat, or personal library content is visible.
- The native Zotero Reader right sidebar is visible in the key interaction scenes.
- Every product claim can be tied to a visible feature or to the approved pricing wording.

## Verification Plan

- Review a draft at 1x speed with sound and without sound.
- Confirm captions remain readable at 1280x720 and do not cover the active control.
- Check every configuration frame at 200% for keys, personal metadata, file paths, notifications, and unreadable text.
- Verify all feature shots against the clean profile before final render.
- Render an H.264 MP4 from Remotion, inspect it on a desktop player, then review the final duration and audio peak levels.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Personal library data leaks into a capture. | Use a separate profile and dedicated data directory; do not open the personal profile during recording. |
| AI polish makes the UI look fabricated. | Capture real product UI first; restrict generated assets to support material only. |
| Voice-over is too dense for one minute. | Keep each narration line tied to one visible action and cap the script to about 160 Chinese characters. |
| "Free" is understood as model inference being free. | State "插件免费使用" or "免费使用的 Zotero AI 阅读助手"; add a pricing note only if the final distribution context requires it. |
| The video becomes a configuration tutorial. | Limit configuration proof to 14 seconds and return immediately to reading actions. |

## Open Questions

- Select the final example paper and whether it should be an open-access real paper or a fully synthetic paper designed for legibility.
- Confirm the preferred AI voice: neutral female, neutral male, or a defined reference voice.
- Confirm whether the final call to action points to GitHub, a Zotero plugin marketplace listing, or another existing public destination.
