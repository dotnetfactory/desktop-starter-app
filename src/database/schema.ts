import Database from 'better-sqlite3';

/**
 * Desktop Starter App Database Schema
 *
 * Tables:
 * - settings: Application settings key-value store
 *
 * Add your own tables below by following the pattern.
 */

export function initializeDatabase(db: Database.Database): void {
  console.log('Initializing database schema...');

  // Create settings table
  createSettingsTable(db);

  // Add your table creation calls here
  // Example: createYourTable(db);

  console.log('Database schema initialization complete');
}

function createSettingsTable(db: Database.Database): void {
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='settings'
  `).get();

  if (!tableExists) {
    console.log('Creating settings table...');
    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    console.log('settings table created successfully');
  }
}

// Example: Add your own tables
// function createYourTable(db: Database.Database): void {
//   const tableExists = db.prepare(`
//     SELECT name FROM sqlite_master
//     WHERE type='table' AND name='your_table'
//   `).get();
//
//   if (!tableExists) {
//     db.exec(`
//       CREATE TABLE your_table (
//         id TEXT PRIMARY KEY,
//         name TEXT NOT NULL,
//         created_at INTEGER NOT NULL,
//         updated_at INTEGER NOT NULL
//       );
//     `);
//   }
// }
