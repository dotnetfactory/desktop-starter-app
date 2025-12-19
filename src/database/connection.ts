import Database from 'better-sqlite3';
import { initializeDatabase } from './schema';
import { getDatabasePath, ensureDatabaseDirectory } from './config';

let dbInstance: Database.Database | null = null;
let currentDbPath: string | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbPath = getDatabasePath();
    ensureDatabaseDirectory(dbPath);

    dbInstance = new Database(dbPath);
    currentDbPath = dbPath;

    // Enable WAL mode for better concurrent performance
    dbInstance.pragma('journal_mode = WAL');

    // Initialize schema
    initializeDatabase(dbInstance);

    console.log(`Database initialized at: ${dbPath}`);
  }

  return dbInstance;
}

export function getCurrentDatabasePath(): string | null {
  return currentDbPath;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log('Database connection closed');
  }
}

// Helper function to generate UUIDs (simple version)
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
