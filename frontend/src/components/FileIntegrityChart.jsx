import React, { useState, useEffect } from 'react';
import { apiGetAnalyticsDistribution } from '../services/api';

const ANOMALY_CONFIG = {
    Modified: { label: 'Modified', color: '#F59E0B' },
    Deleted: { label: 'Deleted', color: '#EF4444' },
    New: { label: 'New', color: '#3B82F6' },
    Renamed_Moved: { label: 'Renamed / Moved', color: '#8B5CF6' },
    Copied_Duplicate: { label: 'Copied / Duplicate', color: '#EC4899' }
};

export default function FileIntegrityChart({ scanCount }) {
    const [viewMode, setViewMode] = useState('current'); // 'current' or 'cumulative'
    const [distributionData, setDistributionData] = useState({ current: {}, cumulative: {} });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchDistribution = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiGetAnalyticsDistribution();
            if (res.success) {
                setDistributionData({
                    current: res.current || {},
                    cumulative: res.cumulative || {}
                });
            } else {
                setError('Failed to load integrity distribution data.');
            }
        } catch (err) {
            setError('Backend connection error.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDistribution();
    }, [scanCount]);

    const activeStats = distributionData[viewMode] || {};
    const safeCount = Number(activeStats['Safe']) || 0;

    let totalAnomalies = 0;
    const anomalyStats = {};
    Object.keys(ANOMALY_CONFIG).forEach(key => {
        const count = Number(activeStats[key]) || 0;
        anomalyStats[key] = count;
        totalAnomalies += count;
    });

    const totalFiles = safeCount + totalAnomalies;

    const centerX = 100;
    const centerY = 100;
    const innerRadius = 58; // Thicker ring
    const outerRadius = 96; // Larger outer radius

    // Helper to generate precise SVG arc path for smooth segments and background track
    const getArcPath = (startAngle, endAngle, innerR, outerR) => {
        const startRad = (startAngle - 90) * (Math.PI / 180);
        const endRad = (endAngle - 90) * (Math.PI / 180);

        const x1 = centerX + outerR * Math.cos(startRad);
        const y1 = centerY + outerR * Math.sin(startRad);
        const x2 = centerX + outerR * Math.cos(endRad);
        const y2 = centerY + outerR * Math.sin(endRad);

        const x3 = centerX + innerR * Math.cos(endRad);
        const y3 = centerY + innerR * Math.sin(endRad);
        const x4 = centerX + innerR * Math.cos(startRad);
        const y4 = centerY + innerR * Math.sin(startRad);

        const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

        return [
            `M ${x1} ${y1}`,
            `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            `L ${x3} ${y3}`,
            `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
            'Z'
        ].join(' ');
    };

    let currentAngle = 0;

    const chartSlices = Object.entries(ANOMALY_CONFIG).map(([key, config]) => {
        const count = anomalyStats[key] || 0;
        const percentage = totalAnomalies > 0 ? (count / totalAnomalies) * 100 : 0;
        const angleSize = totalAnomalies > 0 ? (percentage / 100) * 360 : 0;

        const startAngle = currentAngle;
        const endAngle = currentAngle + angleSize;
        currentAngle = endAngle;

        const path = angleSize > 0.2 ? getArcPath(startAngle, angleSize >= 359.9 ? 359.9 : endAngle, innerRadius, outerRadius) : '';

        return {
            key,
            label: config.label,
            color: config.color,
            count,
            percentage: percentage.toFixed(1),
            path
        };
    });

    return (
        <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.75rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            marginTop: '2rem'
        }}>
            {/* Header & Toggle Switch */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: '700', letterSpacing: '0.3px', color: '#1f2937' }}>
                        File Integrity Distribution
                    </h2>
                    <span style={{ fontSize: '0.82rem', color: '#374151', letterSpacing: '0.3px', fontWeight: '600' }}>
                        {viewMode === 'current' ? 'Real-Time Current Integrity Test' : 'Cumulative (Current & Past All Together) Test Stats'}
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-main)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <button
                        onClick={() => setViewMode('current')}
                        style={{
                            padding: '0.4rem 0.9rem',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            background: viewMode === 'current' ? 'var(--accent)' : 'transparent',
                            color: viewMode === 'current' ? '#fff' : '#1f2937',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Current Scan
                    </button>
                    <button
                        onClick={() => setViewMode('cumulative')}
                        style={{
                            padding: '0.4rem 0.9rem',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            background: viewMode === 'cumulative' ? 'var(--accent)' : 'transparent',
                            color: viewMode === 'cumulative' ? '#fff' : '#1f2937',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Cumulative (All Scans)
                    </button>
                    <button
                        onClick={fetchDistribution}
                        title="Refresh Stats"
                        style={{ padding: '0.4rem 0.7rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#1f2937', fontWeight: '600' }}
                    >
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {error && <div style={{ color: '#EF4444', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#4b5563' }}>Loading distribution analytics...</div>
            ) : (
                <div>
                    {/* Summary Safe Files & Total Monitored Bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1f2937' }}>Safe Files</span>
                            </div>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: '700', color: '#111827' }}>
                                {safeCount.toLocaleString()} ({totalFiles > 0 ? ((safeCount / totalFiles) * 100).toFixed(2) : 100.00}%)
                            </span>
                        </div>
                        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1f2937' }}>Total Monitored Files</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: '700', color: '#111827' }}>
                                {totalFiles.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Chart and Anomaly Breakdown Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', alignItems: 'center', gap: '2rem', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.25rem' }}>

                        {/* Larger Scaled SVG Donut Chart */}
                        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                            <svg width="270" height="270" viewBox="0 0 200 200">
                                <path
                                    d={getArcPath(0, 359.9, innerRadius, outerRadius)}
                                    fill="var(--border)"
                                    opacity="0.35"
                                />
                                {totalAnomalies > 0 ? (
                                    chartSlices.map((slice) => (
                                        slice.path && (
                                            <path
                                                key={slice.key}
                                                d={slice.path}
                                                fill={slice.color}
                                                style={{ transition: 'all 0.3s ease' }}
                                            />
                                        )
                                    ))
                                ) : (
                                    <path
                                        d={getArcPath(0, 359.9, innerRadius, outerRadius)}
                                        fill="#10B981"
                                        opacity="0.2"
                                    />
                                )}
                            </svg>

                            {/* Center Statistics Label */}
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center',
                                pointerEvents: 'none'
                            }}>
                                <div style={{ fontSize: '2.1rem', fontWeight: '800', color: '#111827', lineHeight: '1' }}>
                                    {totalAnomalies}
                                </div>
                                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '4px' }}>
                                    Total Anomalies
                                </div>
                            </div>
                        </div>

                        {/* Anomaly Breakdown Legend */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1f2937', letterSpacing: '0.3px', marginBottom: '0.2rem' }}>
                                File Anomaly Breakdown
                            </div>
                            {chartSlices.map((slice) => (
                                <div key={slice.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem', background: 'var(--bg-card)', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: slice.color, display: 'inline-block' }}></span>
                                        <span style={{ color: '#1f2937', fontWeight: '600' }}>{slice.label}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontFamily: 'monospace', fontWeight: '600', minWidth: '135px' }}>
                                        <span style={{ color: '#374151', width: '60px', textAlign: 'right' }}>{slice.count} files</span>
                                        <span style={{ color: '#9ca3af', margin: '0 6px' }}>|</span>
                                        <span style={{ color: '#111827', width: '50px', textAlign: 'right' }}>{slice.percentage}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}