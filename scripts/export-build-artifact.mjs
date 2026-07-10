import path from "node:path";
import pkg from "../package.json" with { type: "json" };
import {
  buildVisibleExportContext,
  exportVisibleBuildArtifacts,
} from "./export-build-artifact-lib.mjs";
import { buildVerificationContext } from "./verify-build-artifact-lib.mjs";

const projectRoot = process.cwd();
const buildRoot = path.resolve(".scaffold/build");
const verification = buildVerificationContext({ buildRoot, pkg });
const exportContext = buildVisibleExportContext({ projectRoot, verification });
const exported = exportVisibleBuildArtifacts(exportContext);

console.log("Finder-friendly XPI artifacts exported:");
for (const file of exported) {
  console.log(`- ${path.relative(projectRoot, file)}`);
}
