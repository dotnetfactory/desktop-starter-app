import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import '../types/app-config.d';

interface DatabaseConfig {
  dbPath: string;
}

const CONFIG_FILENAME = 'db-config.json';

/**
 * Get the path to the config file (stored in userData, not synced)
 */
function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

/**
 * Get the default database path (in Documents folder)
 */
export function getDefaultDatabasePath(): string {
  const documentsPath = app.getPath('documents');
  const appDir = path.join(documentsPath, __APP_CONFIG__.appDataFolder);
  return path.join(appDir, __APP_CONFIG__.dbFilename);
}

/**
 * Get the legacy database path (in Application Support)
 */
export function getLegacyDatabasePath(): string {
  return path.join(app.getPath('userData'), __APP_CONFIG__.dbFilename);
}

/**
 * Load the database config, returning the configured path or null if not set
 */
export function loadDatabaseConfig(): DatabaseConfig | null {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as DatabaseConfig;
  } catch (error) {
    console.error('Failed to load database config:', error);
    return null;
  }
}

/**
 * Save the database config
 */
export function saveDatabaseConfig(config: DatabaseConfig): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`Database config saved: ${config.dbPath}`);
}

/**
 * Get the current database path, handling migration from legacy location
 */
export function getDatabasePath(): string {
  const config = loadDatabaseConfig();

  // If config exists, use the configured path
  if (config) {
    return config.dbPath;
  }

  // Check if legacy database exists
  const legacyPath = getLegacyDatabasePath();
  if (fs.existsSync(legacyPath)) {
    // Legacy database exists, keep using it until user migrates
    return legacyPath;
  }

  // No existing database, use the new default location (Documents)
  return getDefaultDatabasePath();
}

/**
 * Ensure the directory for the database exists
 */
export function ensureDatabaseDirectory(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created database directory: ${dir}`);
  }
}

/**
 * Check if migration from legacy location is available
 */
export function canMigrateFromLegacy(): boolean {
  const config = loadDatabaseConfig();
  const legacyPath = getLegacyDatabasePath();

  // Can migrate if: no config set yet AND legacy database exists
  return !config && fs.existsSync(legacyPath);
}

/**
 * Migrate database from one location to another
 * Returns true if successful
 */
export function migrateDatabase(sourcePath: string, destPath: string): { success: boolean; error?: string } {
  try {
    // Ensure source exists
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: `Source database not found: ${sourcePath}` };
    }

    // Ensure destination directory exists
    ensureDatabaseDirectory(destPath);

    // Check if destination already exists
    if (fs.existsSync(destPath)) {
      return { success: false, error: `Destination already exists: ${destPath}` };
    }

    // Copy the main database file
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied database: ${sourcePath} -> ${destPath}`);

    // Copy WAL file if it exists
    const walSource = sourcePath + '-wal';
    const walDest = destPath + '-wal';
    if (fs.existsSync(walSource)) {
      fs.copyFileSync(walSource, walDest);
      console.log(`Copied WAL file`);
    }

    // Copy SHM file if it exists
    const shmSource = sourcePath + '-shm';
    const shmDest = destPath + '-shm';
    if (fs.existsSync(shmSource)) {
      fs.copyFileSync(shmSource, shmDest);
      console.log(`Copied SHM file`);
    }

    // Save the new config
    saveDatabaseConfig({ dbPath: destPath });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Database migration failed:', error);
    return { success: false, error: message };
  }
}

/**
 * Get info about current database location
 */
export function getDatabaseInfo(): {
  currentPath: string;
  isLegacyLocation: boolean;
  canMigrate: boolean;
  legacyPath: string;
  defaultPath: string;
} {
  const currentPath = getDatabasePath();
  const legacyPath = getLegacyDatabasePath();
  const defaultPath = getDefaultDatabasePath();

  return {
    currentPath,
    isLegacyLocation: currentPath === legacyPath,
    canMigrate: canMigrateFromLegacy(),
    legacyPath,
    defaultPath,
  };
}
