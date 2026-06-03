interface BuildDevProfilePrefsOptions {
  env?: Record<string, string | undefined>;
  prefsPrefix: string;
}

const DEFAULT_EVIDENCE_PROVIDER_MODE = "mcp-web-search";

function normalizeBooleanPref(
  value: string | undefined,
): boolean | undefined {
  if (value == null || value === "") {
    return undefined;
  }

  return value === "1" || value.toLowerCase() === "true";
}

function normalizeEvidenceProviderPref(
  value: string | undefined,
): typeof DEFAULT_EVIDENCE_PROVIDER_MODE | "tavily" | undefined {
  if (!value) {
    return undefined;
  }

  return value === "tavily" ? "tavily" : DEFAULT_EVIDENCE_PROVIDER_MODE;
}

export function buildDevProfilePrefs({
  env = ((globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env ?? {}) as Record<string, string | undefined>,
  prefsPrefix,
}: BuildDevProfilePrefsOptions): Record<string, string | boolean> {
  const prefs: Record<string, string | boolean> = {};

  const setPref = (key: string, value: string | boolean | undefined) => {
    if (value === undefined || value === "") {
      return;
    }
    prefs[`${prefsPrefix}.${key}`] = value;
  };

  setPref("apiKey", env.DEEPSEEK_API_KEY || env.API_KEY);
  setPref("model", env.DEEPSEEK_MODEL);
  setPref(
    "evidenceEnabled",
    normalizeBooleanPref(env.DS_COPILOT_EVIDENCE_ENABLED),
  );
  setPref(
    "evidenceProviderMode",
    normalizeEvidenceProviderPref(env.DS_COPILOT_EVIDENCE_PROVIDER),
  );
  setPref("tavilyApiKey", env.TAVILY_API_KEY);

  return prefs;
}
