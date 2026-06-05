import React, { useState } from 'react'
import Calculator from './components/Calculator'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import BottomNav from './components/BottomNav'
import { useConfig } from './hooks/useConfig'

export default function App() {
  const [activeTab, setActiveTab] = useState('calculator')
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Load config at the root level so Settings can trigger a refresh
  // that propagates down to Calculator and Dashboard.
  const { config, loading: configLoading, refresh } = useConfig()

  const handleSettingsSaved = () => {
    refresh()
    setSettingsOpen(false)
  }

  return (
    <div className="app">
      {/* Global top bar with gear icon */}
      <div className="app-topbar">
        <div className="app-topbar__spacer" />
        <button
          id="btn-open-settings"
          className={`app-topbar__gear ${settingsOpen ? 'app-topbar__gear--active' : ''}`}
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label={settingsOpen ? 'Cerrar configuración' : 'Abrir configuración'}
          aria-expanded={settingsOpen}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Settings overlay */}
      {settingsOpen && (
        <div className="settings-overlay" role="dialog" aria-label="Configuración" aria-modal="true">
          <Settings config={config} onSaved={handleSettingsSaved} />
        </div>
      )}

      {/* Main content */}
      <div className="app__content">
        {!settingsOpen && activeTab === 'calculator' && (
          <Calculator config={config} configLoading={configLoading} />
        )}
        {!settingsOpen && activeTab === 'dashboard' && <Dashboard />}
      </div>

      {/* Bottom nav — hidden while settings open */}
      {!settingsOpen && (
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  )
}
