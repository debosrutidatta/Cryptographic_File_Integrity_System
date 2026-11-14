import React, { useState, useEffect, useRef } from 'react';

export default function TargetSelector({ userId, onScanComplete }) {
    const [currentPath, setCurrentPath] = useState('');
    const [parentPath, setParentPath] = useState(null);
    const [history, setHistory] = useState([]);
    const [entries, setEntries] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedPath, setSelectedPath] = useState('');
    const [currentTargetId, setCurrentTargetId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState('');
    const [statusMessage, setStatusMessage] = useState(null);

    const searchTimeoutRef = useRef(null);
    const searchContainerRef = useRef(null);

    useEffect(() => {
        fetchDirectory('');

        const handleClickOutside = (event) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setSearchResults([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const fetchDirectory = async (path = '', skipHistoryPush = false) => {
        setError('');
        setLoading(true);
        setSearchQuery('');
        setSearchResults([]);
        try {
            let url = 'http://localhost:5000/api/browse';
            if (path === 'DRIVES') {
                url = 'http://localhost:5000/api/browse?path=DRIVES';
            } else if (path) {
                url = `http://localhost:5000/api/browse?path=${encodeURIComponent(path)}`;
            }

            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                if (currentPath && currentPath !== data.current_path && !skipHistoryPush && currentPath !== 'Computer / Drives') {
                    setHistory(prev => [...prev, currentPath]);
                }
                setCurrentPath(data.current_path);
                setParentPath(data.parent_path);
                setEntries(data.entries);
            } else {
                setError(data.error || 'Failed to browse directory.');
            }
        } catch (err) {
            setError('Failed to connect to backend server.');
        } finally {
            setLoading(false);
        }
    };

    const executeSearch = async (query) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const url = `http://localhost:5000/api/search?q=${encodeURIComponent(query)}&path=${encodeURIComponent(currentPath)}`;
            const res = await fetch(url);
            const data = await res.json();
            setSearchResults(data.results || []);
        } catch {
            setSearchResults([]);
        }
    };

    const handleSearchChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }

        searchTimeoutRef.current = setTimeout(() => {
            executeSearch(query);
        }, 300);
    };

    const handleSearchFocus = () => {
        if (searchQuery.length >= 2 && searchResults.length === 0) {
            executeSearch(searchQuery);
        }
    };

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            executeSearch(searchQuery);
        }
    };

    const handleSearchResultClick = (resultPath) => {
        fetchDirectory(resultPath);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleFolderClick = (entryPath) => {
        fetchDirectory(entryPath);
    };

    const handleBack = () => {
        if (history.length === 0) return;
        const previousPath = history[history.length - 1];
        setHistory(prev => prev.slice(0, history.length - 1));
        fetchDirectory(previousPath, true);
    };

    const handleUp = () => {
        if (parentPath) {
            fetchDirectory(parentPath);
        }
    };

    const handleShowDrives = () => {
        fetchDirectory('DRIVES');
    };

    const handleQuickShortcut = async (subFolder) => {
        try {
            const response = await fetch('http://localhost:5000/api/browse');
            const data = await response.json();
            if (data.success) {
                const basePath = data.current_path;
                const targetShortcutPath = `${basePath}/${subFolder}`;
                fetchDirectory(targetShortcutPath);
            }
        } catch (err) {
            setError('Failed to load shortcut.');
        }
    };

    const handleSelectCurrentFolder = async () => {
        if (currentPath === 'Computer / Drives') return;
        setSelectedPath(currentPath);
        setCurrentTargetId(null);
        setStatusMessage({ text: `Initializing target scope: ${currentPath}...`, type: 'info' });

        try {
            const regResponse = await fetch('http://localhost:5000/api/targets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_path: currentPath, added_by: userId })
            });
            const regData = await regResponse.json();
            if (regData.success) {
                setCurrentTargetId(regData.target_id);

                const isNewBaseline = regResponse.status === 201;
                const statusText = isNewBaseline
                    ? `Initial baseline established for new target: ${currentPath} (${regData.file_count} files recorded as Safe)`
                    : `Existing target selected: ${currentPath}. Ready for integrity scan or baseline refresh.`;

                setStatusMessage({ text: statusText, type: 'success' });
            } else {
                setError(regData.error || 'Failed to initialize target.');
            }
        } catch (err) {
            setError('Network error initializing target.');
        }
    };

    const handleRunScan = async () => {
        setError('');
        setStatusMessage(null);
        setScanning(true);

        try {
            setStatusMessage({ text: `Running cryptographic integrity comparison against baseline...`, type: 'info' });

            const scanResponse = await fetch('http://localhost:5000/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ triggered_by: userId, target_id: currentTargetId })
            });
            const scanData = await scanResponse.json();

            if (scanData.success) {
                setStatusMessage({
                    text: `Integrity scan completed! Analyzed ${scanData.total_files_scanned} files against baseline.`,
                    type: 'success'
                });
                if (onScanComplete) onScanComplete(scanData.report);
            } else {
                setError(scanData.error || 'Scan execution failed.');
            }
        } catch (err) {
            setError('Network error during scan execution.');
        } finally {
            setScanning(false);
        }
    };

    const handleRefreshBaseline = async () => {
        if (!currentTargetId) return;
        setError('');
        setStatusMessage({ text: `Refreshing baseline for target ID #${currentTargetId}...`, type: 'info' });

        try {
            const res = await fetch(`http://localhost:5000/api/targets/${currentTargetId}/refresh`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                setStatusMessage({
                    text: `Baseline refreshed successfully! ${data.file_count} files recorded as Safe.`,
                    type: 'success'
                });
            } else {
                setError(data.error || 'Failed to refresh baseline.');
            }
        } catch (err) {
            setError('Network error during baseline refresh.');
        }
    };

    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', fontWeight: '600', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                Visual File Manager & Target Selector
            </h2>

            {error && <div style={{ marginBottom: '1rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>{error}</div>}

            {statusMessage && (
                <div style={{
                    marginBottom: '1rem',
                    color: statusMessage.type === 'success' ? '#22c55e' : statusMessage.type === 'info' ? 'var(--accent)' : '#ef4444',
                    background: statusMessage.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(79, 70, 229, 0.1)',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '6px',
                    border: `1px solid ${statusMessage.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(79, 70, 229, 0.2)'}`,
                    fontSize: '0.85rem'
                }}>
                    {statusMessage.text}
                </div>
            )}

            {/* Quick Access Bar & Search Input Container */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Quick Access:</span>
                    <button onClick={() => fetchDirectory('')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}>Home</button>
                    <button onClick={() => handleQuickShortcut('OneDrive')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}>OneDrive</button>
                    <button onClick={() => handleQuickShortcut('Documents')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}>Documents</button>
                    <button onClick={() => handleQuickShortcut('Desktop')} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}>Desktop</button>
                </div>

                {/* Search Wrapper with Ref */}
                <div ref={searchContainerRef} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', position: 'relative' }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onFocus={handleSearchFocus}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Search..."
                        style={{
                            padding: '0.3rem 0.5rem',
                            fontSize: '0.8rem',
                            background: 'var(--input-bg)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            width: '180px'
                        }}
                    />
                    {searchResults.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            width: '320px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                            zIndex: 50,
                            marginTop: '4px'
                        }}>
                            <div style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', fontWeight: '600', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                Matching Folders ({searchResults.length}):
                            </div>
                            {searchResults.map((res, i) => (
                                <div
                                    key={i}
                                    onClick={() => handleSearchResultClick(res.path)}
                                    style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.8rem' }}
                                >
                                    <div style={{ fontWeight: '600', color: 'var(--accent)' }}>{res.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.path}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Path Breadcrumb & Navigation Controls Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: 'var(--bg-main)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>
                    <strong>Path:</strong> {currentPath}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                        onClick={handleBack}
                        disabled={history.length === 0}
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', background: history.length === 0 ? 'var(--border)' : 'var(--bg-card)', color: history.length === 0 ? 'var(--text-muted)' : 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', cursor: history.length === 0 ? 'not-allowed' : 'pointer' }}
                    >
                        Back
                    </button>
                    <button
                        onClick={handleUp}
                        disabled={!parentPath}
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', background: !parentPath ? 'var(--border)' : 'var(--bg-card)', color: !parentPath ? 'var(--text-muted)' : 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', cursor: !parentPath ? 'not-allowed' : 'pointer' }}
                    >
                        Up
                    </button>
                    <button
                        onClick={handleShowDrives}
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', fontWeight: '600', cursor: 'pointer' }}
                    >
                        Drives
                    </button>
                    <button
                        onClick={handleSelectCurrentFolder}
                        disabled={currentPath === 'Computer / Drives'}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: currentPath === 'Computer / Drives' ? 'var(--border)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: currentPath === 'Computer / Drives' ? 'not-allowed' : 'pointer' }}
                    >
                        Select This Folder
                    </button>
                </div>
            </div>

            {/* Directory Browser Window */}
            <div style={{ height: '260px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '1rem', background: 'var(--input-bg)' }}>
                {loading ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading directories...</p>
                ) : entries.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Directory is empty or shortcut folder not found.</p>
                ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {entries.map((entry, idx) => (
                            <li
                                key={idx}
                                onClick={() => entry.is_dir && handleFolderClick(entry.path)}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    borderBottom: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: entry.is_dir ? 'pointer' : 'default',
                                    background: selectedPath === entry.path ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <span style={{ fontFamily: 'monospace', color: entry.is_dir ? 'var(--accent)' : 'var(--text-main)', fontWeight: entry.is_dir ? '600' : '400' }}>
                                    {entry.name}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Target & Action Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Target Ready for Scan: <code style={{ color: 'var(--text-main)', fontWeight: '600' }}>{selectedPath || 'None selected (Click "Select This Folder")'}</code>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        type="button"
                        onClick={handleRunScan}
                        disabled={scanning || !currentTargetId}
                        style={{ flex: 1, padding: '0.75rem', backgroundColor: !currentTargetId ? 'var(--border)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', cursor: !currentTargetId ? 'not-allowed' : 'pointer' }}
                    >
                        {scanning ? 'Processing Cryptographic Scan...' : 'Run Integrity Scan'}
                    </button>

                    <button
                        type="button"
                        onClick={handleRefreshBaseline}
                        disabled={!currentTargetId}
                        style={{ padding: '0.75rem 1rem', backgroundColor: !currentTargetId ? 'var(--border)' : 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: !currentTargetId ? 'not-allowed' : 'pointer' }}
                        title="Reset baseline to current disk state"
                    >
                        Refresh Baseline
                    </button>
                </div>
            </div>
        </div>
    );
}