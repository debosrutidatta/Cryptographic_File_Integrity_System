import React, { useState } from 'react';

export default function ScanReport({ report }) {
    const [activeTab, setActiveTab] = useState('Safe');
    const [isExpanded, setIsExpanded] = useState(false);

    if (!report) {
        return (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active scan report available. Select a target and execute an integrity scan to populate findings.
            </div>
        );
    }

    const states = [
        { key: 'Safe', label: 'Safe', color: '#22c55e' },
        { key: 'Modified', label: 'Modified', color: '#f59e0b' },
        { key: 'Deleted', label: 'Deleted', color: '#ef4444' },
        { key: 'New', label: 'New', color: '#3b82f6' },
        { key: 'Renamed_Moved', label: 'Renamed / Moved', color: '#8b5cf6' },
        { key: 'Copied_Duplicate', label: 'Copied / Duplicate', color: '#ec4899' }
    ];

    const currentItems = report[activeTab] || [];
    const activeStateObj = states.find(s => s.key === activeTab) || states[0];

    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '600' }}>
                    6-State Integrity Report Viewer
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: activeStateObj.color, background: `${activeStateObj.color}15`, padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                        State: {activeStateObj.label} ({currentItems.length})
                    </span>
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
                            color: 'var(--text-main)'
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

            {/* State Summary Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {states.map((state) => {
                    const count = (report[state.key] || []).length;
                    const isActive = activeTab === state.key;
                    return (
                        <button
                            key={state.key}
                            onClick={() => setActiveTab(state.key)}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                borderRadius: '6px',
                                border: `1px solid ${isActive ? state.color : 'var(--border)'}`,
                                background: isActive ? `${state.color}15` : 'var(--bg-main)',
                                color: isActive ? state.color : 'var(--text-main)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}
                        >
                            <span>{state.label}</span>
                            <span style={{
                                background: isActive ? state.color : 'var(--border)',
                                color: isActive ? '#fff' : 'var(--text-main)',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '10px',
                                fontSize: '0.75rem'
                            }}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Findings Table with Dynamic Height */}
            <div style={{ height: isExpanded ? '550px' : '300px', transition: 'height 0.3s ease', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--input-bg)' }}>
                {currentItems.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No files recorded under the "{activeStateObj.label}" state.
                    </p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>File Path</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentItems.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>
                                        {typeof item === 'string' ? item : item.path || JSON.stringify(item)}
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