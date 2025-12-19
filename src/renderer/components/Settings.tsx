/**
 * Settings Component
 *
 * Configuration panel for database location and app info.
 */

import React, { useState, useEffect } from 'react';
import './Settings.css';
import { DatabaseInfo } from '../../types/window';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'storage' | 'about'>('storage');

  // Database location state
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string } | null>(null);

  // App version
  const [appVersion, setAppVersion] = useState<string>('...');

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      // Load database info
      const dbInfoResult = await window.api.database.getInfo();
      if (dbInfoResult.success && dbInfoResult.data) {
        setDbInfo(dbInfoResult.data);
      }

      // Load app version
      const versionResult = await window.api.app.getVersion();
      if (versionResult.success && versionResult.data) {
        setAppVersion(versionResult.data);
      }
    };
    loadSettings();
  }, []);

  const handleMigrateToDocuments = async () => {
    if (!dbInfo?.isLegacyLocation) {
      setMigrationResult({ success: false, message: 'Database is already in Documents folder.' });
      return;
    }

    setMigrating(true);
    setMigrationResult(null);

    try {
      const result = await window.api.database.migrateToDocuments();
      if (result.success && result.data) {
        setMigrationResult({
          success: true,
          message: `Database moved successfully! New location: ${result.data.newPath}`,
        });
        // Refresh database info
        const dbInfoResult = await window.api.database.getInfo();
        if (dbInfoResult.success && dbInfoResult.data) {
          setDbInfo(dbInfoResult.data);
        }
      } else {
        setMigrationResult({
          success: false,
          message: result.error?.message || 'Migration failed.',
        });
      }
    } catch {
      setMigrationResult({ success: false, message: 'Failed to migrate database.' });
    } finally {
      setMigrating(false);
    }
  };

  const handleShowInFinder = async () => {
    await window.api.database.showInFinder();
  };

  const handleSelectExisting = async () => {
    setMigrationResult(null);

    try {
      const result = await window.api.database.selectExisting();
      if (result.success && result.data) {
        setMigrationResult({
          success: true,
          message: `Database switched! Now using: ${result.data.newPath}. Please restart the app for changes to take full effect.`,
        });
        // Refresh database info
        const dbInfoResult = await window.api.database.getInfo();
        if (dbInfoResult.success && dbInfoResult.data) {
          setDbInfo(dbInfoResult.data);
        }
      } else if (result.error?.code !== 'CANCELLED') {
        setMigrationResult({
          success: false,
          message: result.error?.message || 'Failed to select database.',
        });
      }
    } catch {
      setMigrationResult({ success: false, message: 'Failed to select database.' });
    }
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'storage' ? 'active' : ''}`}
            onClick={() => setActiveTab('storage')}
          >
            Storage
          </button>
          <button
            className={`settings-tab ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            About
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'storage' && (
            <section className="settings-section">
              <h3>Database Location</h3>
              <p className="section-description">
                Your data is stored in a local SQLite database. Moving it to Documents enables cloud sync across
                devices.
              </p>

              {dbInfo && (
                <div className="database-info">
                  <div className="db-path-display">
                    <label>Current Location:</label>
                    <code className="db-path">{dbInfo.currentPath}</code>
                    <button className="btn-secondary btn-small" onClick={handleShowInFinder}>
                      Show in Finder
                    </button>
                  </div>

                  <div className={`db-status ${dbInfo.isLegacyLocation ? 'warning' : 'success'}`}>
                    {dbInfo.isLegacyLocation ? (
                      <>
                        <span className="status-icon">!</span>
                        <span>Database is in Application Support (not synced)</span>
                      </>
                    ) : (
                      <>
                        <span className="status-icon">OK</span>
                        <span>Database is in Documents folder</span>
                      </>
                    )}
                  </div>

                  {dbInfo.isLegacyLocation && (
                    <div className="migration-section">
                      <h4>Move to Documents Folder</h4>
                      <p className="migration-description">
                        This will copy your database to the Documents folder. Your existing data will be preserved.
                      </p>

                      <button className="primary-button" onClick={handleMigrateToDocuments} disabled={migrating}>
                        {migrating ? 'Moving Database...' : 'Move to Documents'}
                      </button>
                    </div>
                  )}

                  <div className="migration-section">
                    <h4>Use Existing Database</h4>
                    <p className="migration-description">
                      Connect to an existing database file from another device or backup.
                    </p>

                    <button className="btn-secondary" onClick={handleSelectExisting}>
                      Select Database File...
                    </button>
                  </div>

                  {migrationResult && (
                    <div className={`test-result ${migrationResult.success ? 'success' : 'error'}`}>
                      {migrationResult.message}
                    </div>
                  )}
                </div>
              )}

              {!dbInfo && <p className="loading-text">Loading database information...</p>}
            </section>
          )}

          {activeTab === 'about' && (
            <section className="settings-section about-section">
              <h3>About</h3>
              <p className="about-text">
                Desktop Starter App is a template for building production-ready Electron applications with React and
                TypeScript.
              </p>
              <p className="version-text">Version {appVersion}</p>
              <div className="about-links">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.api.shell.openExternal(`https://github.com/${__APP_CONFIG__.github.owner}/${__APP_CONFIG__.github.repo}`);
                  }}
                >
                  GitHub Repository
                </a>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
