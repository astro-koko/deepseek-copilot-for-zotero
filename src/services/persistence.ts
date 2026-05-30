import type { Thread } from "../types/thread";

const DB_NAME = "zotero-ai-assistant";

function getDB(): any {
  return new (Zotero as any).DBConnection(DB_NAME);
}

export async function initDatabase(): Promise<void> {
  const db = getDB();
  await db.execTransaction(async (conn: any) => {
    await conn.queryAsync(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        scopeSnapshot TEXT,
        messages TEXT NOT NULL
      )
    `);
  });
}

export function saveThread(thread: Thread): void {
  try {
    const db = getDB();
    db.queryAsync(
      `INSERT OR REPLACE INTO threads (id, title, createdAt, updatedAt, scopeSnapshot, messages)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        thread.id,
        thread.title,
        thread.createdAt,
        thread.updatedAt,
        thread.scopeSnapshot ? JSON.stringify(thread.scopeSnapshot) : null,
        JSON.stringify(thread.messages),
      ],
    );
  } catch (e) {
    ztoolkit.log("Failed to save thread:", e);
  }
}

export function loadThread(id: string): Thread | null {
  try {
    const db = getDB();
    const rows = db.queryAsync(
      `SELECT * FROM threads WHERE id = ?`,
      [id],
    );
    if (!rows || rows.length === 0) return null;
    return rowToThread(rows[0]);
  } catch (e) {
    ztoolkit.log("Failed to load thread:", e);
    return null;
  }
}

export function loadAllThreads(): Thread[] {
  try {
    const db = getDB();
    const rows = db.queryAsync(`SELECT * FROM threads`);
    if (!rows || rows.length === 0) return [];
    return rows.map(rowToThread);
  } catch (e) {
    ztoolkit.log("Failed to load threads:", e);
    return [];
  }
}

export function deletePersistedThread(id: string): boolean {
  try {
    const db = getDB();
    db.queryAsync(`DELETE FROM threads WHERE id = ?`, [id]);
    return true;
  } catch (e) {
    ztoolkit.log("Failed to delete thread:", e);
    return false;
  }
}

function rowToThread(row: any): Thread {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    scopeSnapshot: row.scopeSnapshot ? JSON.parse(row.scopeSnapshot) : undefined,
    messages: JSON.parse(row.messages),
  };
}
