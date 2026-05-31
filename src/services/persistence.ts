import type { Thread } from "../types/thread";

let initialized = false;

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
          scopeSnapshot TEXT,
          messages TEXT NOT NULL
        )
      `);
    });
    initialized = true;
    ztoolkit.log("Database initialized");
  } catch (e) {
    ztoolkit.log("Database init error:", e);
  }
}

export async function closeDatabase(): Promise<void> {
  initialized = false;
}

export async function saveThread(thread: Thread): Promise<void> {
  try {
    await initDatabase();
    const db = getDB();
    await db.queryAsync(
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

export async function loadThread(id: string): Promise<Thread | null> {
  try {
    await initDatabase();
    const db = getDB();
    const rows = await db.queryAsync(
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

export async function loadAllThreads(): Promise<Thread[]> {
  try {
    await initDatabase();
    const db = getDB();
    const rows = await db.queryAsync(`SELECT * FROM threads`);
    if (!rows || rows.length === 0) return [];
    return rows.map(rowToThread);
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
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    scopeSnapshot: row.scopeSnapshot ? JSON.parse(row.scopeSnapshot) : undefined,
    messages: JSON.parse(row.messages),
  };
}
