import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Composer } from "./Composer";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Composer layout", () => {
  it("allows the input row to wrap and the textarea to shrink inside narrow sidebars", () => {
    const markup = renderToStaticMarkup(
      React.createElement(Composer, {
        currentScopeType: "paper",
        isStreaming: false,
        onSend: () => {},
      }),
    );

    expect(markup).toContain("flex-wrap:wrap");
    expect(markup).toContain("min-width:0");
    expect(markup).toContain("box-sizing:border-box");
    expect(markup).toContain("width:100%");
  });

  it("renders footer controls for model depth and evidence search near the input", () => {
    vi.stubGlobal("Zotero", {
      Prefs: {
        get: vi.fn((key: string) => (key === "intl.locale.requested" ? "zh-CN" : "")),
      },
    });

    const markup = renderToStaticMarkup(
      React.createElement(Composer, {
        currentScopeType: "paper",
        evidenceEnabled: true,
        evidenceLabel: "联网查证",
        isStreaming: false,
        modelMode: "deep",
        onSend: () => {},
        onToggleEvidence: () => {},
        onModelModeChange: () => {},
      }),
    );

    expect(markup).toContain("轻度思考");
    expect(markup).toContain("深度思考");
    expect(markup).toContain("联网查证");
    expect(markup).not.toContain("OpenAlex");
  });

  it("uses a source-agnostic default evidence label when no custom label is provided", () => {
    vi.stubGlobal("Zotero", {
      Prefs: {
        get: vi.fn((key: string) => (key === "intl.locale.requested" ? "zh-CN" : "")),
      },
    });

    const markup = renderToStaticMarkup(
      React.createElement(Composer, {
        currentScopeType: "paper",
        evidenceEnabled: false,
        isStreaming: false,
        onSend: () => {},
      }),
    );

    expect(markup).toContain("联网查证");
    expect(markup).not.toContain("OpenAlex");
  });

  it("renders inherited typography markup for the composer controls", () => {
    const markup = renderToStaticMarkup(
      React.createElement(Composer, {
        currentScopeType: "paper",
        isStreaming: false,
        onSend: () => {},
      }),
    );

    expect(markup).toContain("font-family:inherit");
    expect(markup).toContain("font-size:1.04em");
    expect(markup).toContain("font-size:0.98em");
  });
});
