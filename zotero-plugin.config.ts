import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";
import { buildDevServerStartArgs } from "./src/config/devServerArgs";
import { buildDevProfilePrefs } from "./src/config/devProfilePrefs";
import { buildAddonVersionMetadata } from "./scripts/build-version-lib.mjs";

declare const process: {
  env: Record<string, string | undefined>;
};

const prefsPrefix = pkg.config.prefsPrefix;
const devStartArgs = buildDevServerStartArgs(process.env.ZOTERO_DEBUGGER);
const devProfilePrefs = buildDevProfilePrefs({ prefsPrefix });
const addonVersion = buildAddonVersionMetadata({
  baseVersion: pkg.version,
  env: process.env,
});
const xpiName = `${pkg.config.addonName.replace(/\s+/g, ".")}-${addonVersion.xpiVersion}`;

const config: ReturnType<typeof defineConfig> = defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  xpiName,
  updateURL: `https://github.com/{{owner}}/{{repo}}/releases/download/release/${addonVersion.updateJsonName}`,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: addonVersion.manifestVersion,
      buildVersionName: addonVersion.displayVersion,
      buildTime: "{{buildTime}}",
    },
    fluent: {
      prefixFluentMessages: false,
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
  },

  server: {
    // Keep dev-only bootstrap here so the built addon never reads from .env.
    // Do not inject plugin prefs into the user's daily profile during proxy-mode runs.
    // On macOS we still need the explicit flag to avoid falling back to another profile.
    devtools: false,
    startArgs: devStartArgs,
    prefs: devProfilePrefs,
    asProxy: true,
    createProfileIfMissing: true,
  },
});

export default config;
