import React, { useState, useEffect } from 'react';
import { apiGetAnalyticsTimeline } from '../services/api';

const STATUS_COLORS = {
    Safe: '#10B981',
    Copied_Duplicate: '#EC4899',
    Renamed_Moved: '#8B5CF6',
    New: '#3B82F6',
    Deleted: '#EF4444',
    Modified: '#F59E0B'
};

export default function FileHistory({ scanCount }) {
    const [history, setHistory] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [historyRes, timelineRes] = await Promise.all([
                fetch('http://localhost:5000/api/file-history').then(r => r.json()),
                apiGetAnalyticsTimeline()
            ]);

            if (historyRes.success) setHistory(historyRes.history || []);
            if (timelineRes.success) setTimeline(timelineRes.timeline || []);
        } catch (err) {
            setError('Failed to connect to backend for forensic history and timeline.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [scanCount]);

    const svgWidth = 680;
    const svgHeight = 225;
    const marginLeft = 68;
    const marginRight = 24;
    const marginTop = 20;
    const marginBottom = 48;
    const plotWidth = svgWidth - marginLeft - marginRight;
    const plotHeight = svgHeight - marginTop - marginBottom;
    const yBottom = marginTop + plotHeight;

    const rawMax = timeline.length > 0
        ? Math.max(...timeline.map(t => Object.values(t).filter(v => typeof v === 'number').reduce((a, b) => Math.max(a, b), 1)), 5)
        : 5;
    const scaledMax = Math.sqrt(rawMax);

    const getYPosition = (val) => {
        if (!val || val <= 0) return yBottom;
        return yBottom - (Math.sqrt(val) / scaledMax) * plotHeight;
    };

    const getXPosition = (index) => {
        if (timeline.length <= 1) return marginLeft + plotWidth / 2;
        return marginLeft + (index / (timeline.length - 1)) * plotWidth;
    };

    const midValue = Math.round(rawMax * 0.25);
    const yTicks = [
        { value: rawMax, y: marginTop },
        { value: midValue, y: getYPosition(midValue) },
        { value: 0, y: yBottom }
    ];

    const xTickIndices = [];
    if (timeline.length > 0) {
        const maxTicks = Math.min(8, timeline.length);
        if (maxTicks === 1) {
            xTickIndices.push(0);
        } else {
            for (let i = 0; i < maxTicks; i++) {
                const idx = Math.round((i / (maxTicks - 1)) * (timeline.length - 1));
                if (!xTickIndices.includes(idx)) xTickIndices.push(idx);
            }
        }
    }

    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: '700', letterSpacing: '0.3px', color: '#1f2937' }}>
                    File Change History & Forensic Investigation
                </h2>
                <button
                    onClick={fetchData}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: '600', background: 'var(--bg-main)', color: '#1f2937', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}
                >
                    ↻ Refresh Logs
                </button>
            </div>

            {error && <div style={{ color: '#EF4444', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

            <div style={{ marginBottom: '2rem', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1f2937', letterSpacing: '0.3px' }}>
                        Integrity Status Timeline (Scan-by-Scan Trend)
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#4b5563', fontWeight: '600' }}>
                        Y-Axis: Square-Root Scale
                    </span>
                </div>

                {loading ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: '#4b5563' }}>Loading timeline graph...</p>
                ) : timeline.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: '#4b5563', fontSize: '0.85rem' }}>No historical scans recorded yet for timeline plotting.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <svg width="100%" height="235" viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ minWidth: '540px', height: '235px', display: 'block' }}>
                            <line x1={marginLeft} y1={marginTop} x2={marginLeft} y2={yBottom} stroke="var(--border)" strokeWidth="1.2" />

                            {yTicks.map((tick, idx) => (
                                <g key={idx}>
                                    <line
                                        x1={marginLeft}
                                        y1={tick.y}
                                        x2={svgWidth - marginRight}
                                        y2={tick.y}
                                        stroke="var(--border)"
                                        strokeWidth="1"
                                        strokeDasharray={tick.value === 0 ? 'none' : '4 4'}
                                        opacity={tick.value === 0 ? '0.8' : '0.45'}
                                    />
                                    <text
                                        x={marginLeft - 8}
                                        y={tick.y + 3.5}
                                        textAnchor="end"
                                        fontSize="10"
                                        fontFamily="monospace"
                                        fill="#374151"
                                    >
                                        {tick.value}
                                    </text>
                                </g>
                            ))}

                            <text
                                x={16}
                                y={marginTop + plotHeight / 2}
                                textAnchor="middle"
                                fontSize="10.5"
                                fontWeight="700"
                                fill="#374151"
                                transform={`rotate(-90, 16, ${marginTop + plotHeight / 2})`}
                            >
                                FILE COUNT
                            </text>

                            {xTickIndices.map((idx) => {
                                const scanItem = timeline[idx];
                                const x = getXPosition(idx);
                                return (
                                    <g key={idx}>
                                        <line x1={x} y1={yBottom} x2={x} y2={yBottom + 5} stroke="var(--border)" strokeWidth="1.2" />
                                        <text
                                            x={x}
                                            y={yBottom + 17}
                                            textAnchor="middle"
                                            fontSize="10"
                                            fontFamily="monospace"
                                            fill="#374151"
                                        >
                                            #{scanItem.scan_id}
                                        </text>
                                    </g>
                                );
                            })}

                            <text
                                x={marginLeft + plotWidth / 2}
                                y={svgHeight - 8}
                                textAnchor="middle"
                                fontSize="10.5"
                                fontWeight="700"
                                fill="#374151"
                            >
                                SCAN SEQUENCE (SCAN ID)
                            </text>

                            {Object.entries(STATUS_COLORS).map(([status, color]) => {
                                const points = timeline.map((t, i) => {
                                    const x = getXPosition(i);
                                    const y = getYPosition(t[status] || 0);
                                    return `${x},${y}`;
                                }).join(' ');

                                return (
                                    <g key={status}>
                                        <polyline
                                            fill="none"
                                            stroke={color}
                                            strokeWidth="2.5"
                                            points={points}
                                            style={{ filter: `drop-shadow(0 0 5px ${color}66)` }}
                                        />
                                        {timeline.map((t, i) => {
                                            const x = getXPosition(i);
                                            const val = t[status] || 0;
                                            const y = getYPosition(val);
                                            return (
                                                <circle key={i} cx={x} cy={y} r="3.5" fill={color}>
                                                    <title>{`${status.replace('_', ' / ')}: ${val} files (Scan #${t.scan_id} at ${t.timestamp})`}</title>
                                                </circle>
                                            );
                                        })}
                                    </g>
                                );
                            })}
                        </svg>

                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.75rem', fontSize: '0.75rem' }}>
                            {[
                                ['Safe', '#10B981'],
                                ['Modified', '#F59E0B'],
                                ['Deleted', '#EF4444'],
                                ['New', '#3B82F6'],
                                ['Renamed_Moved', '#8B5CF6'],
                                ['Copied_Duplicate', '#EC4899']
                            ].map(([key, color]) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }}></span>
                                    <span style={{ color: '#1f2937', fontWeight: '600' }}>{key.replace('_', ' / ')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.75rem', color: '#1f2937', letterSpacing: '0.3px' }}>
                Granular Forensic Change Logs
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-main)' }}>
                {history.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: '#4b5563', fontSize: '0.85rem' }}>No file change history recorded yet. Run an integrity scan!</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', color: '#374151', position: 'sticky', top: 0, zIndex: 1 }}>
                                <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700' }}>Timestamp</th>
                                <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700' }}>File Path</th>
                                <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700' }}>Change Type</th>
                                <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700' }}>Hash / Details</th>
                                <th style={{ padding: '0.6rem 0.8rem', fontWeight: '700' }}>Triggered By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((item) => (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace', color: '#374151', whiteSpace: 'nowrap' }}>{item.changed_at || item.timestamp}</td>
                                    <td style={{ padding: '0.6rem 0.8rem', color: '#111827', fontWeight: '500', wordBreak: 'break-all' }}>{item.file_path}</td>
                                    <td style={{ padding: '0.6rem 0.8rem', whiteSpace: 'nowrap' }}>
                                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700', background: STATUS_COLORS[item.change_type] || '#6B7280', color: '#fff' }}>
                                            {item.change_type}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'monospace', color: '#374151', fontSize: '0.75rem' }}>{item.current_hash || 'N/A'}</td>
                                    <td style={{ padding: '0.6rem 0.8rem', color: 'var(--accent)', fontWeight: '600' }}>{item.triggered_by_user || 'Admin'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}