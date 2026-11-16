import React, { useState, useEffect } from 'react';

export default function ScanHistory({ scanCount }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedScanId, setSelectedScanId] = useState(null);
    const [historicalReport, setHistoricalReport] = useState(null);
    const [activeTab, setActiveTab] = useState('Safe');
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        fetchReports();
    }, [scanCount]);

    const fetchReports = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('http://localhost:5000/api/reports');
            const data = await res.json();
            if (data.success) {
                setReports(data.reports || []);
            } else {
                setError(data.error || 'Failed to load historical scan reports.');
            }
        } catch (err) {
            setError('Failed to connect to backend server for history.');
        } finally {
            setLoading(false);
        }
    };

    const handleViewReport = async (scanId) => {
        setError('');
        try {
            const res = await fetch(`http://localhost:5000/api/reports/${scanId}`);
            const data = await res.json();
            if (data.success && data.results && data.results.length > 0) {
                const grouped = {
                    Safe: [],
                    Modified: [],
                    Deleted: [],
                    New: [],
                    Renamed_Moved: [],
                    Copied_Duplicate: []
                };

                data.results.forEach(item => {
                    const status = item.status;
                    if (grouped[status]) {
                        grouped[status].push(item.file_path);
                    }
                });

                setSelectedScanId(scanId);
                setHistoricalReport(grouped);
            } else {
                setError(`Scan #${scanId} has no detailed file records stored in the database.`);
            }
        } catch (err) {
            setError('Failed to load specific scan details.');
        }
    };

    const handleCloseInspection = () => {
        setSelectedScanId(null);
        setHistoricalReport(null);
    };

    const states = [
        { key: 'Safe', label: 'Safe', color: '#22c55e' },
        { key: 'Modified', label: 'Modified', color: '#f59e0b' },
        { key: 'Deleted', label: 'Deleted', color: '#ef4444' },
        { key: 'New', label: 'New', color: '#3b82f6' },
        { key: 'Renamed_Moved', label: 'Renamed / Moved', color: '#8b5cf6' },
        { key: 'Copied_Duplicate', label: 'Copied / Duplicate', color: '#ec4899' }
    ];

    const currentItems = historicalReport ? (historicalReport[activeTab] || []) : [];
    const activeStateObj = states.find(s => s.key === activeTab) || states[0];

    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '700', color: '#1f2937' }}>
                    Historical Scan Archive
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={fetchReports}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'var(--bg-main)', color: '#1f2937', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                    >
                        ↻ Refresh Archive
                    </button>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        title={isExpanded ? "Collapse View" : "Expand View"}
                        style={{
                            background: 'var(--bg-main)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#1f2937'
                        }}
                    >
                        {isExpanded ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {error && <div style={{ marginBottom: '1rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>{error}</div>}

            {/* Archive Table */}
            <div style={{ height: isExpanded ? '450px' : '220px', transition: 'height 0.3s ease', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--input-bg)', marginBottom: '1.5rem' }}>
                {loading ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: '#4b5563', fontSize: '0.85rem' }}>Loading archive records...</p>
                ) : reports.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: '#4b5563', fontSize: '0.85rem' }}>No historical scan records found.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-main)', color: '#374151' }}>
                                <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>Scan ID</th>
                                <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>Timestamp</th>
                                <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>Files Analyzed</th>
                                <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700', width: '120px', textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((rep) => {
                                const timestampVal = rep.scan_timestamp || rep.timestamp || 'N/A';
                                const isViewing = selectedScanId === rep.id;
                                return (
                                    <tr key={rep.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', color: 'var(--accent)' }}>
                                            Scan #{rep.id}
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', color: '#111827' }}>
                                            {timestampVal}
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', color: '#111827', fontWeight: '500' }}>
                                            {rep.total_files} files
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleViewReport(rep.id)}
                                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: isViewing ? '#4b5563' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: 'pointer' }}
                                            >
                                                {isViewing ? 'Viewing' : 'View Report'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Historic Report Inspector Box with Close Action */}
            {historicalReport && (
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', background: 'var(--bg-main)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '0.95rem', margin: 0, fontWeight: '700', color: 'var(--accent)' }}>
                            Historic Inspection: Scan #{selectedScanId}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: activeStateObj.color, background: `${activeStateObj.color}15`, padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                                State: {activeStateObj.label} ({currentItems.length})
                            </span>
                            <button
                                onClick={handleCloseInspection}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-card)', color: '#1f2937', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                            >
                                Close Inspection
                            </button>
                        </div>
                    </div>

                    {/* State Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                        {states.map((state) => {
                            const count = (historicalReport[state.key] || []).length;
                            const isActive = activeTab === state.key;
                            return (
                                <button
                                    key={state.key}
                                    onClick={() => setActiveTab(state.key)}
                                    style={{
                                        padding: '0.4rem 0.6rem',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        borderRadius: '6px',
                                        border: `1px solid ${isActive ? state.color : 'var(--border)'}`,
                                        background: isActive ? `${state.color}15` : 'var(--bg-card)',
                                        color: isActive ? state.color : '#1f2937',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem'
                                    }}
                                >
                                    <span>{state.label}</span>
                                    <span style={{
                                        background: isActive ? state.color : 'var(--border)',
                                        color: isActive ? '#fff' : '#1f2937',
                                        padding: '0.1rem 0.3rem',
                                        borderRadius: '8px',
                                        fontSize: '0.7rem'
                                    }}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Findings Table */}
                    <div style={{ height: '220px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--input-bg)' }}>
                        {currentItems.length === 0 ? (
                            <p style={{ textAlign: 'center', padding: '2rem', color: '#4b5563', fontSize: '0.8rem' }}>
                                No files recorded under the "{activeStateObj.label}" state for Scan #{selectedScanId}.
                            </p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', color: '#374151' }}>
                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>File Path</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentItems.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', color: '#111827' }}>
                                                {typeof item === 'string' ? item : item.path || JSON.stringify(item)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}