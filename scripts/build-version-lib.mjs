const DEV_CHANNELS = new Set(["dev", "development", "smoke"]);

function getEnvValue(env, key) {
  return env && typeof env[key] === "string" ? env[key].trim() : "";
}

function sanitizeDevNumber(value) {
  if (!/^[1-9][0-9]{0,8}$/.test(value)) {
    throw new Error(
      "DS_COPILOT_DEV_NUMBER must be a positive numeric build number with at most 9 digits.",
    );
  }

  return value;
}

function splitBaseVersion(baseVersion) {
  const [numericVersion, prerelease] = String(baseVersion).split("-", 2);
  const parts = numericVersion.split(".");

  if (
    parts.length < 1 ||
    parts.length > 3 ||
    parts.some((part) => !/^(0|[1-9][0-9]*)$/.test(part))
  ) {
    throw new Error(
      `Package version ${baseVersion} must start with 1 to 3 numeric parts.`,
    );
  }

  return { numericVersion, prerelease };
}

function prereleaseBuildNumber(prerelease) {
  if (!prerelease) {
    return "";
  }

  const numericTokens = prerelease.match(/[0-9]+/g);
  const lastToken = numericTokens?.at(-1) ?? "";
  return lastToken ? sanitizeDevNumber(lastToken) : "1";
}

export function buildAddonVersionMetadata({ baseVersion, env = process.env }) {
  const { numericVersion, prerelease } = splitBaseVersion(baseVersion);
  const channel = getEnvValue(env, "DS_COPILOT_BUILD_CHANNEL").toLowerCase();
  const isDevBuild = DEV_CHANNELS.has(channel);
  const isPrerelease = isDevBuild || Boolean(prerelease);

  if (isDevBuild) {
    const devNumber = sanitizeDevNumber(
      getEnvValue(env, "DS_COPILOT_DEV_NUMBER"),
    );
    const displayVersion = `${numericVersion}-dev.${devNumber}`;

    return {
      channel: "dev",
      displayVersion,
      manifestVersion: `${numericVersion}.${devNumber}`,
      xpiVersion: displayVersion,
      updateJsonName: "update-beta.json",
      isPrerelease,
    };
  }

  const prereleaseNumber = prereleaseBuildNumber(prerelease);
  const displayVersion = prerelease
    ? `${numericVersion}-${prerelease}`
    : numericVersion;

  return {
    channel: prerelease ? "prerelease" : "release",
    displayVersion,
    manifestVersion: prerelease
      ? `${numericVersion}.${prereleaseNumber}`
      : numericVersion,
    xpiVersion: displayVersion,
    updateJsonName: prerelease ? "update-beta.json" : "update.json",
    isPrerelease,
  };
}
