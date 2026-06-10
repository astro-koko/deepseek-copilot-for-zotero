/// <reference types="zotero-types/entries/sandbox" />

declare const _globalThis: typeof globalThis & {
  addon: import("../src/addon").default;
};

declare const addon: import("../src/addon").default;

declare const ztoolkit: import("zotero-plugin-toolkit").ZoteroToolkit;

declare const __env__: "development" | "production";

declare interface Window {
  MozXULElement?: {
    insertFTLIfNeeded?: (ftlPath: string) => void;
  };
}

declare module "node:fs" {
  export function readFileSync(path: string | URL, options: "utf8"): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

declare interface ImportMeta {
  url: string;
}

// DOM globals for React components
declare function setInterval(handler: TimerHandler, timeout?: number, ...arguments: any[]): number;
declare function clearInterval(handle?: number): void;

// fetch for provider layer
declare function fetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response>;
