/**
 * Desktop Starter App - Application Configuration
 *
 * This file contains all app-specific configuration that gets baked into the build.
 * It is committed to version control and shared across the team.
 *
 * For secrets (API keys, certificates), use environment variables or GitHub Secrets.
 */

export const config = {
  // ===========================================================================
  // APP IDENTITY
  // ===========================================================================

  /** App name shown in OS (menu bar, dock, task manager) */
  productName: 'Desktop Starter App',

  /** Binary/executable name (lowercase, hyphens) */
  executableName: 'desktop-starter-app',

  /** macOS bundle identifier (reverse domain notation) */
  appBundleId: 'com.example.desktop-starter-app',

  /** macOS app category */
  appCategory: 'public.app-category.productivity',

  // ===========================================================================
  // DATA STORAGE
  // ===========================================================================

  /** Folder name in user's app data directory (~/Library/Application Support on macOS) */
  appDataFolder: 'DesktopStarterApp',

  /** SQLite database filename */
  dbFilename: 'app.db',

  // ===========================================================================
  // GITHUB (for releases & auto-updates)
  // ===========================================================================

  github: {
    /** GitHub username or organization */
    owner: 'dotnetfactory',

    /** Repository name */
    repo: 'desktop-starter-app',

    /** Set to true if repository is private (requires GH_TOKEN secret) */
    private: false,
  },

  // ===========================================================================
  // FEATURES
  // ===========================================================================

  /** Enable auto-update checks on app startup */
  autoUpdateEnabled: true,

  // ===========================================================================
  // PACKAGE MAINTAINER (for Linux packages)
  // ===========================================================================

  maintainer: 'Emad Ibrahim <emad@emadibrahim.com>',
} as const;

/** Type for the config object */
export type AppConfig = typeof config;
