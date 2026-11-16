import React, { useState, useEffect } from 'react';

export default function SecurityLogs({ scanCount }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, [scanCount]);

    const fetchLogs = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('http://localhost:5000/api/security-logs');
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs || []);
            } else {
                setError(data.error || 'Failed to load security audit logs.');
            }
        } catch (err) {
            setError('Failed to connect to backend server for security logs.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '700', color: '#1f2937' }}>
                    Security Audit Logs
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={fetchLogs}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'var(--bg-main)', color: '#1f2937', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                    >
                        ↻ Refresh Logs
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

            <div style={{ height: isExpanded ? '450px' : '220px', transition: 'height 0.3s ease', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--input-bg)' }}>
                {loading ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: '#4b5563', fontSize: '0.85rem' }}>Loading security audit records...</p>
                ) : logs.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: '#4b5563', fontSize: '0.85rem' }}>No security events recorded.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-main)', color: '#374151' }}>
                                <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>Timestamp</th>
                                <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>Event Type</th>
                                <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>Details</th>
                                <th style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>IP Address</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', color: '#111827', whiteSpace: 'nowrap' }}>
                                        {log.timestamp}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', color: 'var(--accent)' }}>
                                        {log.event_type}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', color: '#111827' }}>
                                        {log.details}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', color: '#374151' }}>
                                        {log.ip_address || 'N/A'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}