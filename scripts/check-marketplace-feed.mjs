#!/usr/bin/env node
import pkg from "../package.json" with { type: "json" };

const DEFAULT_FEED_URLS = [
  "https://raw.githubusercontent.com/syt2/zotero-addons-scraper/publish/addon_infos.json",
  "https://cdn.jsdelivr.net/gh/syt2/zotero-addons-scraper@publish/addon_infos.json",
  "https://raw.githubusercontent.com/zotero-chinese/zotero-plugins/gh-pages/dist/plugins.json",
  "https://cdn.jsdelivr.net/gh/zotero-chinese/zotero-plugins@gh-pages/dist/plugins.json",
];

function parseArgs(argv) {
  const args = {
    feedUrls: (process.env.DS_COPILOT_MARKETPLACE_FEED_URLS || "")
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean),
    target: process.env.DS_COPILOT_MARKETPLACE_TARGET || "10",
    repo: process.env.DS_COPILOT_MARKETPLACE_REPO || repoSlugFromPackage(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--feed-url" && next) {
      args.feedUrls.push(next);
      index += 1;
    } else if (arg === "--target" && next) {
      args.target = next;
      index += 1;
    } else if (arg === "--repo" && next) {
      args.repo = next;
      index += 1;
    }
  }

  if (args.feedUrls.length === 0) {
    args.feedUrls = DEFAULT_FEED_URLS;
  }

  return args;
}

function repoSlugFromPackage() {
  const repositoryUrl = pkg.repository?.url || pkg.homepage || "";
  const match = repositoryUrl.match(
    /github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/#.]+)(?:\.git)?/,
  );
  if (!match?.groups) {
    throw new Error("Unable to infer GitHub repo from package metadata.");
  }
  return `${match.groups.owner}/${match.groups.repo}`;
}

async function fetchJson(url) {
  if (url.startsWith("file://")) {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(new URL(url), "utf8"));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Marketplace feed request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

function normalizeFeed(feed) {
  if (Array.isArray(feed)) {
    return feed;
  }
  if (Array.isArray(feed?.plugins)) {
    return feed.plugins;
  }
  if (Array.isArray(feed?.data)) {
    return feed.data;
  }
  return [];
}

function findRelease(feed, repo, target) {
  const addons = normalizeFeed(feed);
  const addon = addons.find((entry) => entry.repo === repo);
  if (!addon) {
    return { addon: undefined, release: undefined };
  }
  const release = addon.releases?.find(
    (candidate) => String(candidate.targetZoteroVersion) === String(target),
  );
  return { addon, release };
}

function printSuccess({ repo, target, release, source }) {
  console.log(
    `Marketplace feed contains ${repo} for Zotero ${target}: ${release.tagName} (${release.minZoteroVersion} - ${release.maxZoteroVersion})`,
  );
  console.log(`Source: ${source}`);
}

function releaseTargets(addon) {
  return (addon?.releases || [])
    .map((release) => release.targetZoteroVersion)
    .join(", ");
}

async function checkSource({ repo, target, feedUrl }) {
  const feed = await fetchJson(feedUrl);
  const { addon, release } = findRelease(feed, repo, target);
  return { addon, release, source: feedUrl };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const failures = [];
  const missing = [];

  for (const feedUrl of args.feedUrls) {
    try {
      const result = await checkSource({
        repo: args.repo,
        target: args.target,
        feedUrl,
      });
      if (result.release) {
        printSuccess({
          repo: args.repo,
          target: args.target,
          release: result.release,
          source: result.source,
        });
        return;
      }
      missing.push({ source: feedUrl, targets: releaseTargets(result.addon) });
    } catch (error) {
      failures.push({ source: feedUrl, message: error.message });
    }
  }

  console.error(
    `No checked marketplace feed contains ${args.repo} for Zotero ${args.target}.`,
  );
  for (const item of missing) {
    console.error(
      `- ${item.source}: repo present=${Boolean(item.targets)}, targets=${item.targets || "none"}`,
    );
  }
  for (const failure of failures) {
    console.error(`- ${failure.source}: ${failure.message}`);
  }
  console.error(
    "Goal not met yet: publish a new GitHub release with the Zotero 10-compatible XPI, then wait for the Add-on Market/Zotero Chinese feeds to refresh.",
  );
  process.exit(1);
}

await main();
