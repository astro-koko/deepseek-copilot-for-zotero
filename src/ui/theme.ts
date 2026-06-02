export interface SidebarTheme {
  background: string;
  panelBackground: string;
  surfaceBackground: string;
  text: string;
  mutedText: string;
  border: string;
  softBorder: string;
  buttonText: string;
  buttonBorder: string;
  noticeBackground: string;
  noticeBorder: string;
  noticeText: string;
  noticeTitle: string;
  warningBackground: string;
  warningBorder: string;
  warningText: string;
  badgeBackground: string;
  badgeBorder: string;
  badgeText: string;
  accentBackground: string;
  accentBorder: string;
  accentText: string;
  errorBackground: string;
  errorBorder: string;
  errorText: string;
  inputBackground: string;
  inputBorder: string;
  userMessageBackground: string;
  userMessageBorder: string;
  assistantMessageBackground: string;
  assistantMessageBorder: string;
  systemMessageBackground: string;
  systemMessageBorder: string;
}

const lightTheme: SidebarTheme = {
  background: "#f7f7f7",
  panelBackground: "#f6f6f6",
  surfaceBackground: "#ffffff",
  text: "#222222",
  mutedText: "#666666",
  border: "#d7d7d7",
  softBorder: "#e0e0e0",
  buttonText: "#333333",
  buttonBorder: "#c9c9c9",
  noticeBackground: "#faf7ef",
  noticeBorder: "#e4dac0",
  noticeText: "#6f6138",
  noticeTitle: "#5d4d23",
  warningBackground: "#f7f3e6",
  warningBorder: "#e5dcc0",
  warningText: "#7b5d17",
  badgeBackground: "#edf4fb",
  badgeBorder: "#d6e5f4",
  badgeText: "#2a5a86",
  accentBackground: "#f7f1dc",
  accentBorder: "#e7dfc3",
  accentText: "#6d5a1f",
  errorBackground: "#fbf1f1",
  errorBorder: "#ead2d2",
  errorText: "#8d3838",
  inputBackground: "#ffffff",
  inputBorder: "#d4d4d4",
  userMessageBackground: "#f5f6f7",
  userMessageBorder: "#d9dde1",
  assistantMessageBackground: "#ffffff",
  assistantMessageBorder: "#dedede",
  systemMessageBackground: "#f6f6f6",
  systemMessageBorder: "#e1e1e1",
};

const darkTheme: SidebarTheme = {
  background: "#26272b",
  panelBackground: "#2d2f34",
  surfaceBackground: "#343740",
  text: "#f2f3f5",
  mutedText: "#c2c7cf",
  border: "#464b55",
  softBorder: "#3d4149",
  buttonText: "#eef1f4",
  buttonBorder: "#575d68",
  noticeBackground: "#403827",
  noticeBorder: "#5d5138",
  noticeText: "#e7d8ad",
  noticeTitle: "#f3e5be",
  warningBackground: "#463a27",
  warningBorder: "#6b5738",
  warningText: "#f0da9d",
  badgeBackground: "#2b3b4d",
  badgeBorder: "#3a536e",
  badgeText: "#cfe1f6",
  accentBackground: "#4a4024",
  accentBorder: "#6a5d36",
  accentText: "#f0e2aa",
  errorBackground: "#4b2d2d",
  errorBorder: "#744545",
  errorText: "#ffd5d5",
  inputBackground: "#23252a",
  inputBorder: "#555b66",
  userMessageBackground: "#3c4048",
  userMessageBorder: "#555b66",
  assistantMessageBackground: "#31343b",
  assistantMessageBorder: "#4b5059",
  systemMessageBackground: "#383b42",
  systemMessageBorder: "#50555f",
};

export function getSidebarTheme(win?: Window | null): SidebarTheme {
  try {
    if (win?.matchMedia?.("(prefers-color-scheme: dark)")?.matches) {
      return darkTheme;
    }
  } catch {
    // Ignore host theme probe failures and fall back to light theme.
  }

  return lightTheme;
}
