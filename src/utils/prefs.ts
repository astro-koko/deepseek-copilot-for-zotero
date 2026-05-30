import { config } from "../../package.json";

const prefsPrefix = config.prefsPrefix;

export function getPref(key: string): any {
  return Zotero.Prefs.get(`${prefsPrefix}.${key}`, true);
}

export function setPref(key: string, value: any): void {
  return Zotero.Prefs.set(`${prefsPrefix}.${key}`, value, true);
}

export function clearPref(key: string): void {
  return Zotero.Prefs.clear(`${prefsPrefix}.${key}`, true);
}
