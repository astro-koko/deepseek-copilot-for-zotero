import fs from "node:fs";
import path from "node:path";
import pkg from "../package.json" with { type: "json" };

const buildRoot = path.resolve(".scaffold/build");
const required = [
  path.join(buildRoot, `${pkg.config.addonName}-${pkg.version}.xpi`),
  path.join(buildRoot, "addon/bootstrap.js"),
  path.join(buildRoot, "addon/manifest.json"),
  path.join(buildRoot, "addon/prefs.js"),
  path.join(buildRoot, "addon/content/preferences.xhtml"),
  path.join(buildRoot, `addon/content/scripts/${pkg.config.addonRef}.js`),
];

const missing = required.filter((file) => !fs.existsSync(file));

if (missing.length > 0) {
  console.error("Missing packaged addon artifacts:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("Packaged addon artifacts verified.");
