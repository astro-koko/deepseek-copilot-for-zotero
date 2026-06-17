import { describe, expect, it } from "vitest";

import config from "../../zotero-plugin.config";

describe("zotero-plugin config", () => {
  it("disables Browser Toolbox during the default dev serve loop", () => {
    expect(config.server?.devtools).toBe(false);
  });
});
