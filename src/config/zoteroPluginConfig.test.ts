import { describe, expect, it } from "vitest";
import manifest from "../../addon/manifest.json";

import config from "../../zotero-plugin.config";

describe("zotero-plugin config", () => {
  it("disables Browser Toolbox during the default dev serve loop", () => {
    expect(config.server?.devtools).toBe(false);
  });

  it("advertises Zotero 7 through Zotero 10 compatibility for marketplace discovery", () => {
    expect(manifest.applications.zotero.strict_min_version).toBe("7.0");
    expect(manifest.applications.zotero.strict_max_version).toBe("10.*");
  });
});
