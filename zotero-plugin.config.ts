import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";
import { buildDevServerStartArgs } from "./src/config/devServerArgs";
import { buildDevProfilePrefs } from "./src/config/devProfilePrefs";

const prefsPrefix = pkg.config.prefsPrefix;
const devStartArgs = buildDevServerStartArgs(process.env.ZOTERO_DEBUGGER);
const devProfilePrefs = buildDevProfilePrefs({ prefsPrefix });

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  xpiName: `${pkg.config.addonName}-${pkg.version}`,
  updateURL: `https://github.com/{{owner}}/{{repo}}/releases/download/release/${
    pkg.version.includes("-") ? "update-beta.json" : "update.json"
  }`,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
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
    startArgs: devStartArgs,
    prefs: devProfilePrefs,
    asProxy: true,
    createProfileIfMissing: true,
  },
});
