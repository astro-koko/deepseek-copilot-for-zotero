import { config } from "../../package.json";

export { initLocale, getString, getLocaleID, getRequestedLanguage, isChineseLocale };

function initLocale() {
  const language = getRequestedLanguage();
  if (!language) return;
  const prefix = config.addonRef;
  const strings = Services.strings.createBundle(
    `chrome://${prefix}/locale/${language}/${prefix}-mainWindow.ftl`,
  );
  addon.data.locale = { current: strings };
}

function getString(name: string): string {
  const locale = addon.data.locale?.current;
  if (!locale) return name;
  try {
    return locale.GetStringFromName(name);
  } catch {
    return name;
  }
}

function getLocaleID(name: string): string {
  return name;
}

function getRequestedLanguage(): string {
  try {
    const prefLanguage =
      (Zotero?.Prefs?.get?.("intl.locale.requested", true) as string) || "";
    if (prefLanguage) {
      return prefLanguage;
    }

    const runtimeLanguage =
      (Services as any)?.locale?.requestedLocale ||
      (Services as any)?.locale?.appLocaleAsBCP47 ||
      ((globalThis as unknown as { navigator?: { language?: string } }).navigator?.language) ||
      "";

    return String(runtimeLanguage || "");
  } catch {
    return "";
  }
}

function isChineseLocale(language = getRequestedLanguage()): boolean {
  return language.toLowerCase().startsWith("zh");
}
