import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// --- Type Definitions ---
export interface Config {
  ghlEmail: string;
  ghlPassword?: string;
  loginUrl?: string;
  targetWebhook?: string;
  sessionState?: string; // JSON string of the session state
}

const dbDir = path.join(process.cwd(), 'db');
fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'database.sqlite');
let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath, { verbose: console.log });
    // Initialize schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS configurations (
        ghlEmail TEXT PRIMARY KEY,
        ghlPassword TEXT,
        loginUrl TEXT,
        targetWebhook TEXT,
        sessionState TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Trigger to update 'updatedAt' timestamp
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_configurations_updatedAt
      AFTER UPDATE ON configurations
      FOR EACH ROW
      BEGIN
        UPDATE configurations SET updatedAt = CURRENT_TIMESTAMP WHERE ghlEmail = OLD.ghlEmail;
      END;
    `);
  }
  return db;
}

export function saveConfig(config: Config) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO configurations (ghlEmail, ghlPassword, loginUrl, targetWebhook)
    VALUES (@ghlEmail, @ghlPassword, @loginUrl, @targetWebhook)
    ON CONFLICT(ghlEmail) DO UPDATE SET
      ghlPassword = excluded.ghlPassword,
      loginUrl = excluded.loginUrl,
      targetWebhook = excluded.targetWebhook;
  `);
  stmt.run(config);
}

export function saveSession(email: string, sessionState: string) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE configurations SET sessionState = ? WHERE ghlEmail = ?
  `);
  const result = stmt.run(sessionState, email);

  // If no row was updated, it means the user doesn't exist yet. Create them.
  if (result.changes === 0) {
      const insertStmt = db.prepare(`
        INSERT INTO configurations (ghlEmail, sessionState) VALUES (?, ?)
      `);
      insertStmt.run(email, sessionState);
  }
}

export function deleteSession(email: string) {
    const db = getDb();
    const stmt = db.prepare(`
        UPDATE configurations SET sessionState = NULL WHERE ghlEmail = ?
    `);
    stmt.run(email);
}

// Close the database connection on application shutdown
process.on('exit', () => {
  if (db) {
    db.close();
  }
});
