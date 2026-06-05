import path from "node:path";

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

function normalizeArchiveEntry(entry) {
  return entry.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

export function buildVerificationContext({ buildRoot, pkg }) {
  const xpiFileName = `${pkg.config.addonName.replace(/\s+/g, ".")}-${pkg.version}.xpi`;
  const xpiPath = path.join(
    buildRoot,
    xpiFileName,
  );
  const updateJsonName = pkg.version.includes("-")
    ? "update-beta.json"
    : "update.json";

  return {
    xpiPath,
    requiredFiles: [
      xpiPath,
      path.join(buildRoot, updateJsonName),
      path.join(buildRoot, "addon/bootstrap.js"),
      path.join(buildRoot, "addon/manifest.json"),
      path.join(buildRoot, "addon/prefs.js"),
      path.join(buildRoot, "addon/content/preferences.xhtml"),
      path.join(buildRoot, `addon/content/scripts/${pkg.config.addonRef}.js`),
    ],
    requiredArchiveEntries: [
      "bootstrap.js",
      "manifest.json",
      "prefs.js",
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
