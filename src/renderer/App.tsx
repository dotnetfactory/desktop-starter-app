/**
 * Desktop Starter App - Main App Component
 */

import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { Settings } from 'lucide-react';
import { Settings as SettingsModal } from './components/Settings';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  // Load app version
  useEffect(() => {
    window.api.app.getVersion().then((result) => {
      if (result.success && result.data) {
        setAppVersion(result.data);
      }
    });
  }, []);

  // Listen for auto-update events
  useEffect(() => {
    window.api.app.onUpdateAvailable((version) => {
      toast.info(`Update v${version} available, downloading...`);
    });

    window.api.app.onUpdateDownloaded((version) => {
      toast.success(`Update v${version} ready!`, {
        duration: Infinity,
        action: {
          label: 'Restart Now',
          onClick: () => window.api.app.quitAndInstall(),
        },
      });
    });

    return () => {
      window.api.app.removeUpdateListeners();
    };
  }, []);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="app-logo">
            <h1 className="app-title">Desktop Starter App</h1>
          </div>
        </div>
        <div className="header-right">
          <button onClick={() => setShowSettings(true)} className="settings-button">
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        <div className="welcome-content">
          <h2>Welcome to Your Desktop App</h2>
          <p>
            This is a starter template for building Electron + React + TypeScript desktop applications.
          </p>
          <p>It includes:</p>
          <ul className="feature-list">
            <li>Auto-updates via GitHub Releases</li>
            <li>SQLite database with settings storage</li>
            <li>Window state persistence</li>
            <li>Cross-platform builds (macOS, Windows, Linux)</li>
            <li>CI/CD with GitHub Actions</li>
          </ul>
          <p className="version-info">Version {appVersion}</p>
          <p className="cta-text">
            Edit <code>src/renderer/App.tsx</code> to start building your app.
          </p>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Toast notifications */}
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
