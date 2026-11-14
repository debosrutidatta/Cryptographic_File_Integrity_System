import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import TargetSelector from './components/TargetSelector';
import ScanReport from './components/ScanReport';
import ScanHistory from './components/ScanHistory';
import SecurityLogs from './components/SecurityLogs';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);
  const [theme, setTheme] = useState('light');
  const [, setTargets] = useState([]);
  const [currentScanReport, setCurrentScanReport] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLoginSuccess = (id) => {
    setUserId(id);
    setIsAuthenticated(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    setIsAuthenticated(false);
    setUserId(null);
    setCurrentScanReport(null);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', position: 'relative' }}>
      {!isAuthenticated ? (
        <Login onLoginSuccess={handleLoginSuccess} theme={theme} toggleTheme={toggleTheme} />
      ) : (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '600' }}>Cryptographic File Integrity System Dashboard</h1>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Authenticated Administrator (ID: {userId})</span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={toggleTheme}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '6px', fontWeight: '500', cursor: 'pointer' }}
              >
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </button>
              <button
                onClick={() => setShowLogoutModal(true)}
                style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '500', cursor: 'pointer' }}
              >
                Logout
              </button>
            </div>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
            {/* Step 1: Target Selector & File Manager */}
            <TargetSelector
              userId={userId}
              onScanComplete={(report) => setCurrentScanReport(report)}
              onTargetUpdated={(fetchedTargets) => setTargets(fetchedTargets)}
            />

            {/* Step 2: Dedicated Live Scan Results Viewer */}
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Active Live Scan Workspace
              </div>
              <ScanReport report={currentScanReport} />
            </div>

            {/* Step 3: Historical Scans Archive & Historic Inspector */}
            <ScanHistory />

            {/* Step 4: Security Audit Logs Viewer */}
            <SecurityLogs />
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '2rem',
            width: '400px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.2rem', fontWeight: '600' }}>
              Confirm Session Termination
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Are you sure you want to end your current session?
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLogout}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                Confirm Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;