import path from "node:path";
import { buildAddonVersionMetadata } from "./build-version-lib.mjs";

const ALLOWED_ARCHIVE_TOP_LEVEL_ENTRIES = new Set([
  "bootstrap.js",
  "manifest.json",
  "prefs.js",
  "content",
  "locale",
]);

const FORBIDDEN_ARCHIVE_ENTRY_PATTERNS = [
  /(^|\/)\.env($|[./])/,
  /(^|\/)[^/]+\.sqlite$/,
  /(^|\/)[^/]+\.db$/,
  /(^|\/)(?:\.scaffold|scaffold|dev-data|dev-profile|release-profile|profile)(\/|$)/,
];

const ARCHIVE_TEXT_ENTRY_PATTERN =
  /\.(?:cjs|cts|ftl|js|json|jsx|md|mjs|mts|ts|tsx|xhtml|xml|ya?ml)$/i;

const ARCHIVE_SECRET_PATTERNS = [
  {
    label: "OpenAI-style key",
    pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    label: "GitHub personal access token",
    pattern: /\bghp_[A-Za-z0-9]{20,}\b/g,
  },
  {
    label: "GitHub fine-grained token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    label: "Slack token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    label: "Bearer token",
    pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/g,
  },
  {
    label: "Private key block",
    pattern: /-----BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY-----/g,
  },
];

function normalizeArchiveEntry(entry) {
  return entry.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

export function buildVerificationContext({
  buildRoot,
  pkg,
  env = process.env,
}) {
  const addonVersion = buildAddonVersionMetadata({
    baseVersion: pkg.version,
    env,
  });
  const xpiFileName = `${pkg.config.addonName.replace(/\s+/g, ".")}-${addonVersion.xpiVersion}.xpi`;
  const xpiPath = path.join(buildRoot, xpiFileName);

  return {
    xpiPath,
    addonVersion,
    requiredFiles: [
      xpiPath,
      path.join(buildRoot, addonVersion.updateJsonName),
      path.join(buildRoot, "addon/bootstrap.js"),
      path.join(buildRoot, "addon/manifest.json"),
      path.join(buildRoot, "addon/prefs.js"),
      path.join(buildRoot, "addon/content/katex/LICENSE.txt"),
      path.join(buildRoot, "addon/content/katex/katex.min.css"),
      path.join(
        buildRoot,
        "addon/content/katex/fonts/KaTeX_Main-Regular.woff2",
      ),
      path.join(buildRoot, "addon/content/preferences.xhtml"),
      path.join(buildRoot, `addon/content/scripts/${pkg.config.addonRef}.js`),
    ],
    requiredArchiveEntries: [
      "bootstrap.js",
      "manifest.json",
      "prefs.js",
      "content/katex/LICENSE.txt",
      "content/katex/katex.min.css",
      "content/katex/fonts/KaTeX_Main-Regular.woff2",
      "content/preferences.xhtml",
      `content/scripts/${pkg.config.addonRef}.js`,
    ],
  };
}

export function findMissingArchiveEntries(requiredEntries, archiveEntries) {
  const normalizedEntries = new Set(
    archiveEntries.map((entry) =>
      normalizeArchiveEntry(entry).replace(/\/$/, ""),
    ),
  );

  return requiredEntries.filter((entry) => !normalizedEntries.has(entry));
}

export function findForbiddenArchiveEntries(archiveEntries) {
  return archiveEntries
    .map(normalizeArchiveEntry)
    .filter(
      (entry) =>
        entry !== "" &&
        FORBIDDEN_ARCHIVE_ENTRY_PATTERNS.some((pattern) => pattern.test(entry)),
    );
}

export function findUnexpectedArchiveEntries(archiveEntries) {
  return archiveEntries.map(normalizeArchiveEntry).filter((entry) => {
    if (!entry) {
      return false;
    }

    const topLevel = entry.replace(/\/$/, "").split("/")[0];
    return !ALLOWED_ARCHIVE_TOP_LEVEL_ENTRIES.has(topLevel);
  });
}

export function isTextArchiveEntry(entry) {
  return ARCHIVE_TEXT_ENTRY_PATTERN.test(normalizeArchiveEntry(entry));
}

export function findSensitiveArchiveContent(entry, content) {
  const findings = [];
  for (const { label, pattern } of ARCHIVE_SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      findings.push(`${label} in ${normalizeArchiveEntry(entry)}`);
    }
  }
  return findings;
}
