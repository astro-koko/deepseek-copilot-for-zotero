import { runPrivacyCheck } from "./privacy-check-lib.mjs";

const findings = runPrivacyCheck();

if (findings.length > 0) {
  console.error("Privacy check failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Privacy check passed.");
