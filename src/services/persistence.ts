import type { Thread } from "../types/thread";

const DB_NAME = "zotero-ai-assistant";
let dbConnection: any = null;

function getDB(): any {
  if (!dbConnection) {
    dbConnection = new (Zotero as any).DBConnection(DB_NAME);
  }
  return dbConnection;
}

export async function initDatabase(): Promise<void> {
  const db = getDB();
  try {
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
    ztoolkit.log("Database initialized");
  } catch (e) {
    ztoolkit.log("Database init error:", e);
  }
}

export async function closeDatabase(): Promise<void> {
  if (dbConnection) {
    try {
      await dbConnection.closeDatabase();
    } catch (e) {
      ztoolkit.log("Database close error:", e);
    }
    dbConnection = null;
  }
}

export async function saveThread(thread: Thread): Promise<void> {
  try {
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
