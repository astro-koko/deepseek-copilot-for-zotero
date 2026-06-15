import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const IGNORED_DIRS = new Set([
  ".git",
  ".scaffold",
  "coverage",
  "dist",
  "node_modules",
  "reference",
]);

const ALLOWED_SECRET_TEST_PATTERNS = [
  /sk-test/i,
  /sk-validating/i,
  /sk-new/i,
  /sk-internal-defaults/i,
  /tvly-test/i,
];

const FORBIDDEN_FILE_NAMES = new Set([
  ".env",
  ".npmrc",
  "addonStartup.json.lz4",
  "cookies.sqlite",
]);

const FORBIDDEN_FILE_PATTERNS = [
  /(^|\/)\.env\./,
  /(^|\/)(?:profile|dev-profile|release-profile|dev-data)(\/|$)/,
  /\.(?:sqlite|sqlite-shm|sqlite-wal|db)$/i,
  /\.(?:pem|p12|pfx|key)$/i,
];

const TEXT_FILE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".xhtml",
  ".xml",
  ".yml",
  ".yaml",
  ".ftl",
]);

const SECRET_PATTERNS = [
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

function shouldSkipDir(name) {
  return IGNORED_DIRS.has(name);
}

function shouldInspectTextFile(filePath) {
  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isAllowedSecretMatch(match) {
  return ALLOWED_SECRET_TEST_PATTERNS.some((pattern) => pattern.test(match));
}

function collectFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(ROOT, fullPath);

    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) {
        continue;
      }
      collectFiles(fullPath, results);
      continue;
    }

    results.push({
      fullPath,
      relativePath,
      name: entry.name,
    });
  }

  return results;
}

function scanForbiddenFiles(files) {
  const findings = [];

  for (const file of files) {
    const normalizedPath = file.relativePath.split(path.sep).join("/");

    if (
      FORBIDDEN_FILE_NAMES.has(file.name) ||
      FORBIDDEN_FILE_PATTERNS.some((pattern) => pattern.test(normalizedPath))
    ) {
      findings.push(`forbidden file path: ${normalizedPath}`);
    }
  }

  return findings;
}

function scanFileContents(files) {
  const findings = [];

  for (const file of files) {
    if (!shouldInspectTextFile(file.relativePath)) {
      continue;
    }

    const content = fs.readFileSync(file.fullPath, "utf8");
    const normalizedPath = file.relativePath.split(path.sep).join("/");

    for (const { label, pattern } of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const value = match[0];
        if (isAllowedSecretMatch(value)) {
          continue;
        }
        findings.push(`${label} in ${normalizedPath}`);
      }
    }
  }

  return findings;
}

const files = collectFiles(ROOT);
const findings = [
  ...scanForbiddenFiles(files),
  ...scanFileContents(files),
];

if (findings.length > 0) {
  console.error("Privacy check failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Privacy check passed.");
