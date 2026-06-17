import type { Thread } from "../types/thread";

let initialized = false;

const LEGACY_PROMPT_REPLACEMENTS: Array<[string, string]> = [
  [
    "Please provide a concise summary of this paper. Include the main research question, methodology, key findings, and conclusions. Keep it to 3-5 paragraphs.",
    "请用简洁的方式总结这篇论文。请涵盖核心研究问题、方法、关键发现和结论，控制在 3 到 5 段。",
  ],
  [
    "Please explain the current concept, paragraph, or result in clear, accessible terms. Break down technical jargon and connect it back to the paper's broader argument.",
    "请用清晰、易懂的语言解释当前概念、段落或结果。拆解专业术语，并说明它与论文整体论点之间的关系。",
  ],
  [
    "Identify the paper's core contribution. Explain what is genuinely new, why it matters, and how the authors justify that contribution.",
    "请识别这篇论文的核心贡献。说明真正的新意是什么、为什么重要，以及作者是如何论证这项贡献的。",
  ],
  [
    "Analyze the methodology used in this paper. Explain the method step by step, its assumptions, and where the approach is likely to be strong or weak.",
    "请拆解这篇论文的方法。逐步说明方法流程、关键假设，以及该方法最可能强或弱的地方。",
  ],
  [
    "Identify the key limitations of this study. Consider methodology, data, assumptions, evaluation design, generalizability, and possible over-claims.",
    "请识别这项研究的关键局限。考虑方法、数据、假设、评估设计、可推广性以及可能存在的过度结论。",
  ],
  [
    "Assess whether the paper's central claim is well supported. Separate what is directly supported by the paper from what needs outside verification or stronger evidence.",
    "请评估论文的核心结论是否得到充分支持。区分哪些内容是论文直接支持的，哪些部分需要额外查证或更强证据。",
  ],
  [
    "Provide the background context a researcher would need before reading this paper deeply. Explain the field context, key terms, and the problem setting.",
    "请补充深入阅读这篇论文前所需的背景信息。解释相关领域背景、关键术语和问题设置。",
  ],
  [
    "Place this paper in the broader literature. Explain what prior work it builds on, where it differs, and what nearby directions a researcher should also know.",
    "请把这篇论文放回更广泛的研究脉络中。说明它建立在哪些前人工作之上、与它们有何不同，以及还应关注哪些相邻方向。",
  ],
  ["Summarize this paper", "总结这篇论文"],
  ["Explain this section", "解释这一部分"],
  ["Explain this excerpt", "解释这段摘录"],
];

function getDB() {
  return Zotero.DB;
}

export async function initDatabase(): Promise<void> {
  if (initialized) {
    return;
  }

  const db = getDB();
  try {
    await db.executeTransaction(async () => {
      await db.queryAsync(`
        CREATE TABLE IF NOT EXISTS threads (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          scopeKey TEXT,
          scopeSnapshot TEXT,
          messages TEXT NOT NULL
        )
      `);
    });
    initialized = true;
    ztoolkit.log("Database initialized");
  } catch (e) {
    ztoolkit.log("Database init error:", e);
    throw e;
  }
}

export async function closeDatabase(): Promise<void> {
  initialized = false;
}

export async function saveThread(thread: Thread): Promise<void> {
  try {
    await initDatabase();
    const db = getDB();
    await insertThread(db, thread);
  } catch (e) {
    if (isMissingScopeKeyColumnError(e)) {
      await ensureScopeKeyColumn();
      await insertThread(getDB(), thread);
      return;
    }
    ztoolkit.log("Failed to save thread:", e);
    throw e;
  }
}

async function insertThread(
  db: ReturnType<typeof getDB>,
  thread: Thread,
): Promise<void> {
  await db.queryAsync(
    `INSERT OR REPLACE INTO threads (id, title, createdAt, updatedAt, scopeKey, scopeSnapshot, messages)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      thread.id,
      thread.title,
      thread.createdAt,
      thread.updatedAt,
      thread.scopeKey ?? deriveThreadScopeKey(thread.scopeSnapshot) ?? null,
      thread.scopeSnapshot ? JSON.stringify(thread.scopeSnapshot) : null,
      JSON.stringify(thread.messages),
    ],
  );
}

async function ensureScopeKeyColumn(): Promise<void> {
  await getDB().queryAsync(`ALTER TABLE threads ADD COLUMN scopeKey TEXT`);
}

function isMissingScopeKeyColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /scopeKey/i.test(message) && /column|no such/i.test(message);
}

export async function loadThread(id: string): Promise<Thread | null> {
  try {
    await initDatabase();
    const db = getDB();
    const rows = await db.queryAsync(
      `SELECT * FROM threads WHERE id = ?`,
      [id],
    );
    if (!rows || rows.length === 0) return null;
    const { changed, thread } = migrateLegacyThread(rowToThread(rows[0]));
    if (changed) {
      await saveThread(thread);
    }
    return thread;
  } catch (e) {
    ztoolkit.log("Failed to load thread:", e);
    return null;
  }
}

export async function loadAllThreads(): Promise<Thread[]> {
  try {
    await initDatabase();
    const db = getDB();
    const rows = await db.queryAsync(`SELECT * FROM threads`);
    if (!rows || rows.length === 0) return [];
    const migratedThreads = rows.map((row) => migrateLegacyThread(rowToThread(row)));
    const changedThreads = migratedThreads.filter((entry) => entry.changed).map((entry) => entry.thread);
    if (changedThreads.length > 0) {
      await Promise.all(changedThreads.map((thread) => saveThread(thread)));
    }
    return migratedThreads.map((entry) => entry.thread);
  } catch (e) {
    ztoolkit.log("Failed to load threads:", e);
    return [];
  }
}

export async function deletePersistedThread(id: string): Promise<boolean> {
  try {
    await initDatabase();
    const db = getDB();
    await db.queryAsync(`DELETE FROM threads WHERE id = ?`, [id]);
    return true;
  } catch (e) {
    ztoolkit.log("Failed to delete thread:", e);
    return false;
  }
}

function rowToThread(row: any): Thread {
  const scopeSnapshot = row.scopeSnapshot ? JSON.parse(row.scopeSnapshot) : undefined;
  const scopeKey = row.scopeKey || deriveThreadScopeKey(scopeSnapshot);
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(scopeKey ? { scopeKey } : {}),
    scopeSnapshot,
    messages: JSON.parse(row.messages),
  };
}

function deriveThreadScopeKey(
  scopeSnapshot: Thread["scopeSnapshot"],
): string | undefined {
  if (!scopeSnapshot) return undefined;
  if (scopeSnapshot.scopeKey) return scopeSnapshot.scopeKey;
  if (scopeSnapshot.type === "pdf" && scopeSnapshot.readerAttachmentId) {
    return `pdf-${scopeSnapshot.readerAttachmentId}`;
  }
  if (scopeSnapshot.type === "paper" && scopeSnapshot.itemIds.length === 1) {
    return `paper-${scopeSnapshot.itemIds[0]}`;
  }
  return scopeSnapshot.id;
}

function isChineseLocale(): boolean {
  try {
    const locale =
      (globalThis as unknown as { Zotero?: { locale?: string } }).Zotero?.locale ||
      ((globalThis as unknown as {
        Zotero?: { Prefs?: { get?: (key: string, global?: boolean) => unknown } };
      }).Zotero?.Prefs?.get?.("intl.locale.requested", true) as string) ||
      "";
    return String(locale).toLowerCase().startsWith("zh");
  } catch {
    return false;
  }
}

function migrateLegacyThread(thread: Thread): { changed: boolean; thread: Thread } {
  if (!isChineseLocale()) {
    return { changed: false, thread };
  }

  let changed = false;
  const messages = thread.messages.map((message) => {
    const localizedContent = localizeLegacyPromptText(message.content);
    if (localizedContent === message.content) {
      return message;
    }
    changed = true;
    return {
      ...message,
      content: localizedContent,
    };
  });

  const localizedTitle = localizeLegacyPromptText(thread.title);
  if (localizedTitle !== thread.title) {
    changed = true;
  }

  return {
    changed,
    thread: changed
      ? {
          ...thread,
          title: localizedTitle,
          messages,
        }
      : thread,
  };
}

function localizeLegacyPromptText(content: string): string {
  let localized = content;
  for (const [english, chinese] of LEGACY_PROMPT_REPLACEMENTS) {
    if (localized === english) {
      return chinese;
    }
    if (localized.startsWith(`${english}\n\n`)) {
      return `${chinese}${localized.slice(english.length)}`;
    }
  }

  localized = localized.replace(
    /^Explain the following excerpt from page (\d+) in clear research language:\n\n([\s\S]*)$/u,
    (_match, page: string, quoted: string) =>
      `请用清晰的科研语言解释下面这段来自第 ${page} 页的摘录：\n\n${quoted}`,
  );
  localized = localized.replace(
    /^I am reading page (\d+)\. Based on this excerpt, help me think through it\.\n\n([\s\S]*?)\n\nQuestion:\s*$/u,
    (_match, page: string, quoted: string) =>
      `我正在阅读第 ${page} 页。请基于下面这段摘录帮助我理解并继续思考。\n\n${quoted}\n\n问题：`,
  );
  localized = localized.replace(
    /^Context switched to:\s*/u,
    "上下文已切换至：",
  );

  return localized;
}
