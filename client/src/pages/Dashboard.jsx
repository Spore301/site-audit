import { useParams, Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { ChevronLeft, Layout, GitGraph, AlertCircle, Users, Target, Sparkles } from 'lucide-react';
import UserFlowGraph from '../components/UserFlowGraph';
import PageFlowGraph from '../components/PageFlowGraph';
import API_BASE_URL from '../config';

const Dashboard = () => {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [view, setView] = useState('sitemap');
    const [analyzing, setAnalyzing] = useState(false);
    const [activePersona, setActivePersona] = useState(null);
    const [activePurpose, setActivePurpose] = useState(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/projects/${id}`)
            .then(res => res.json())
            .then(data => {
                setProject(data);
                // Don't auto-select a persona - show full site map by default
                // User can select a persona from the sidebar to filter
            });
    }, [id]);

    const analyzePersonas = () => {
        setAnalyzing(true);
        const isRegenerating = project?.personas?.length > 0;
        fetch(`${API_BASE_URL}/api/projects/${id}/analyze-personas${isRegenerating ? '?force=true' : ''}`, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                setProject(prev => ({ ...prev, ...data }));
                if (data.personas?.length > 0) {
                    setActivePersona(data.personas[0]);
                }
                setAnalyzing(false);
            })
            .catch(err => {
                console.error(err);
                setAnalyzing(false);
                alert('Failed to analyze personas. Make sure AI service is running.');
            });
    };

    const downloadCSV = (data, filename) => {
        const blob = new Blob([data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (!project) return <div className="container" style={{ paddingTop: '4rem' }}>Loading...</div>;

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* Sidebar */}
            <aside style={{ width: '280px', background: '#f8f9fa', borderRight: '1px solid #e5e5e5', padding: '1.5rem', flexShrink: 0, overflowY: 'auto' }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    <ChevronLeft size={16} /> Back to Projects
                </Link>

                <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ marginBottom: '0.25rem', fontSize: '1.1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.domain}</h3>
                    {project.siteSummary ? (
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>
                            <span style={{
                                background: '#e0f2fe',
                                color: '#0369a1',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                textTransform: 'capitalize'
                            }}>
                                {project.siteSummary.siteType}
                            </span>
                            <span style={{ marginLeft: '0.5rem', color: '#888' }}>{project.siteSummary.industry}</span>
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{project.pages.length} Pages Scanned</div>
                    )}
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <button onClick={() => setView('sitemap')} className={`btn`} style={{ justifyContent: 'flex-start', background: view === 'sitemap' ? '#e2e8f0' : 'transparent', color: view === 'sitemap' ? 'black' : '#666' }}>
                        <Layout size={18} style={{ marginRight: '0.5rem' }} /> Sitemap
                    </button>
                    <button onClick={() => setView('flow')} className={`btn`} style={{ justifyContent: 'flex-start', background: view === 'flow' ? '#e2e8f0' : 'transparent', color: view === 'flow' ? 'black' : '#666' }}>
                        <Users size={18} style={{ marginRight: '0.5rem' }} /> Persona Flows
                    </button>
                    <button onClick={() => setView('pageflow')} className={`btn`} style={{ justifyContent: 'flex-start', background: view === 'pageflow' ? '#e2e8f0' : 'transparent', color: view === 'pageflow' ? 'black' : '#666' }}>
                        <GitGraph size={18} style={{ marginRight: '0.5rem' }} /> Page Flow
                    </button>
                    <button onClick={() => setView('broken')} className={`btn`} style={{ justifyContent: 'flex-start', background: view === 'broken' ? '#e2e8f0' : 'transparent', color: view === 'broken' ? 'black' : '#666' }}>
                        <AlertCircle size={18} style={{ marginRight: '0.5rem' }} /> Broken Links
                    </button>
                </nav>

                {/* Persona Selector */}
                {project.personas?.length > 0 && (
                    <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '1rem' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#666', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>User Personas</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {/* Full Site Option */}
                            <button
                                onClick={() => {
                                    setActivePersona(null);
                                    setActivePurpose(null);
                                    setView('flow');
                                }}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    border: '1px solid',
                                    borderColor: activePersona === null ? '#1e7ddf' : '#e5e5e5',
                                    background: activePersona === null ? '#eff6ff' : '#fff',
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Layout size={14} /> Full Site Map
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#666' }}>All pages and connections</div>
                            </button>

                            {project.personas.map(persona => (
                                <button
                                    key={persona.name}
                                    onClick={() => {
                                        setActivePersona(persona);
                                        setActivePurpose(null);
                                        setView('flow');
                                    }}
                                    style={{
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid',
                                        borderColor: activePersona?.name === persona.name ? '#1e7ddf' : '#e5e5e5',
                                        background: activePersona?.name === persona.name ? '#eff6ff' : '#fff',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{persona.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#666', display: 'flex', gap: '0.5rem' }}>
                                        <span>{persona.techSavvy}</span>
                                        <span>•</span>
                                        <span>{persona.visitFrequency}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    onClick={analyzePersonas}
                    disabled={analyzing}
                    style={{
                        marginTop: '1.5rem',
                        width: '100%',
                        padding: '0.75rem',
                        background: '#1e7ddf',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: analyzing ? 'not-allowed' : 'pointer',
                        opacity: analyzing ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        fontWeight: 500
                    }}
                >
                    <Sparkles size={16} />
                    {analyzing ? 'Analyzing...' : project.personas?.length > 0 ? 'Regenerate AI Analysis' : 'Generate AI Analysis'}
                </button>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, padding: '2rem', overflow: 'auto', background: '#fff' }}>
                {view === 'sitemap' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 className="page-title" style={{ fontSize: '1.8rem', marginBottom: 0 }}>Sitemap</h2>
                            <div>
                                <button onClick={() => {
                                    const headers = ['URL', 'Title', 'Type'];
                                    const rows = project.pages.map(p => [p.url, p.title, p.type || 'page']);
                                    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                                    downloadCSV(csvContent, 'sitemap.csv');
                                }} className="btn" style={{ fontSize: '0.9rem' }}>Export CSV</button>
                                <button onClick={() => {
                                    window.open(`${API_BASE_URL}/api/projects/${id}/download-documents`, '_blank');
                                }} className="btn" style={{ fontSize: '0.9rem', marginLeft: '0.5rem' }}>Download Documents (ZIP)</button>
                            </div>
                        </div>

                        {/* Site Summary Card */}
                        {project.siteSummary && (
                            <div style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                padding: '1.5rem',
                                marginBottom: '1.5rem'
                            }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Target size={18} /> Site Summary
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Purpose</div>
                                        <div>{project.siteSummary.purpose}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Target Audience</div>
                                        <div>{project.siteSummary.targetAudience?.join(', ')}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Key Features</div>
                                        <div>{project.siteSummary.keyFeatures?.slice(0, 4).join(', ')}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Tone</div>
                                        <div style={{ textTransform: 'capitalize' }}>{project.siteSummary.tone}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="card">
                            {(() => {
                                const grouped = {};
                                project.pages.forEach(p => {
                                    try {
                                        const u = new URL(p.url);
                                        const pathParts = u.pathname.split('/').filter(Boolean);
                                        const category = pathParts.length > 0 ? pathParts[0].toUpperCase() : 'ROOT';

                                        if (!grouped[category]) grouped[category] = [];
                                        grouped[category].push(p);
                                    } catch (e) {
                                        if (!grouped['Other']) grouped['Other'] = [];
                                        grouped['Other'].push(p);
                                    }
                                });

                                return Object.entries(grouped).sort().map(([category, pages]) => (
                                    <div key={category} style={{ marginBottom: '2rem' }}>
                                        <h3 style={{ fontSize: '1.2rem', color: '#475569', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                                            {category} ({pages.length})
                                        </h3>
                                        <ul style={{ listStyle: 'none' }}>
                                            {pages.map((p, i) => (
                                                <li key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center' }}>
                                                    {p.type === 'document' ? (
                                                        <span style={{ marginRight: '0.5rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>DOC</span>
                                                    ) : (
                                                        <span style={{ marginRight: '0.5rem', background: '#f0fdf4', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>PAGE</span>
                                                    )}
                                                    <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: p.type === 'document' ? '#0369a1' : 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
                                                        {p.url}
                                                    </a>
                                                    <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                        {p.title || 'No Title'}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                )}

                {view === 'flow' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 className="page-title" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>
                                    {activePersona ? activePersona.name : 'Full Site User Flow'}
                                </h2>
                                <p style={{ color: '#666', fontSize: '0.9rem' }}>
                                    {activePersona
                                        ? `AI-generated user journey for ${activePersona.name} on this ${project.siteSummary?.siteType || 'website'}`
                                        : `Complete user flow map showing all pages and connections for ${project.domain}`
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Full Site Map - No persona selected */}
                        {!activePersona && project.personas?.length > 0 && (
                            <>
                                {/* Site Stats Card */}
                                <div style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                    marginBottom: '1.5rem'
                                }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Site Overview</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e7ddf' }}>{project.pages?.length || 0}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Pages</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e7ddf' }}>{project.links?.length || 0}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Links</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e7ddf' }}>{project.personas?.length || 0}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>User Personas</div>
                                        </div>
                                    </div>
                                    <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#666', textAlign: 'center' }}>
                                        Select a persona from the sidebar to see their specific user journey
                                    </p>
                                </div>

                                {/* Full Site Flow Graph */}
                                <div className="card" style={{ padding: 0, overflow: 'hidden', height: '600px' }}>
                                    <UserFlowGraph
                                        pages={project.pages}
                                        links={project.links}
                                        userFlowUrls={[]}
                                    />
                                </div>
                            </>
                        )}

                        {activePersona && (
                            <>
                                {/* Persona Detail Card */}
                                <div style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                    marginBottom: '1.5rem'
                                }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>{activePersona.name}</h3>
                                            <p style={{ color: '#666', fontSize: '0.9rem', maxWidth: '600px' }}>{activePersona.description}</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <span style={{
                                                background: '#e0f2fe',
                                                color: '#0369a1',
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '0.8rem',
                                                fontWeight: 500
                                            }}>
                                                {activePersona.techSavvy}
                                            </span>
                                            <span style={{
                                                background: '#f0fdf4',
                                                color: '#15803d',
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '0.8rem',
                                                fontWeight: 500
                                            }}>
                                                {activePersona.visitFrequency}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                                        <div>
                                            <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Goals</h4>
                                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                                {activePersona.userGoals?.map((goal, i) => {
                                                    const isSelected = activePurpose === goal;
                                                    return (
                                                        <li key={i} style={{ marginBottom: '0.5rem' }}>
                                                            <button 
                                                                onClick={() => setActivePurpose(goal)}
                                                                style={{
                                                                    width: '100%',
                                                                    textAlign: 'left',
                                                                    background: isSelected ? '#1e7ddf' : '#f1f5f9',
                                                                    color: isSelected ? '#ffffff' : '#475569',
                                                                    border: 'none',
                                                                    padding: '0.5rem 1rem',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.9rem',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s',
                                                                    boxShadow: isSelected ? '0 2px 4px rgba(30,125,223,0.3)' : 'none'
                                                                }}
                                                            >
                                                                {goal}
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>

                                        <div>
                                            <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#666', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Pain Points</h4>
                                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                                {activePersona.painPoints?.map((pain, i) => (
                                                    <li key={i} style={{
                                                        padding: '0.5rem 0',
                                                        paddingLeft: '1.25rem',
                                                        position: 'relative',
                                                        fontSize: '0.9rem',
                                                        color: '#666'
                                                    }}>
                                                        <span style={{
                                                            position: 'absolute',
                                                            left: 0,
                                                            color: '#e11d48'
                                                        }}>•</span>
                                                        {pain}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Purpose Filters Error/Disclaimer if no flow exists */}
                                {!activePurpose && (
                                    <div style={{ padding: '1rem', background: '#e0f2fe', color: '#0369a1', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                        <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Select a Purpose</strong>
                                        Click on one of the goals above to view the specific user flow and pages for that purpose.
                                    </div>
                                )}

                                {/* Flow Steps - Extracted Pages Section */}
                                {activePurpose && project.userFlows?.[activePersona.name]?.[activePurpose] && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem' }}>Pages They Might Visit: "{activePurpose}" ({project.userFlows[activePersona.name][activePurpose].steps} steps)</h4>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                                            {project.userFlows[activePersona.name][activePurpose].urls.map((url, i, arr) => (
                                                <React.Fragment key={url}>
                                                    <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            background: i === 0 ? '#1e7ddf' : i === arr.length - 1 ? '#15803d' : '#f1f5f9',
                                                            color: i === 0 || i === arr.length - 1 ? '#fff' : '#475569',
                                                            padding: '0.5rem 1rem',
                                                            borderRadius: '20px',
                                                            fontSize: '0.8rem',
                                                            textDecoration: 'none',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem',
                                                            maxWidth: '250px',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                        }}
                                                        title={url}
                                                    >
                                                        {i === 0 && <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>ENTRY:</span>}
                                                        {i === arr.length - 1 && <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>EXIT:</span>}
                                                        {new URL(url).pathname || '/'}
                                                    </a>
                                                    {i < arr.length - 1 && (
                                                        <span style={{ color: '#94a3b8', fontSize: '1.2rem' }}>{'->'}</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {activePurpose && !project.userFlows?.[activePersona.name]?.[activePurpose] && (
                                    <div style={{ padding: '1rem', background: '#f8fafc', color: '#64748b', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', border: '1px dashed #cbd5e1' }}>
                                        No specific AI flow generated for this specific purpose yet.
                                    </div>
                                )}

                                {/* User Flow Graph */}
                                <div className="card" style={{ padding: 0, overflow: 'hidden', height: '500px', opacity: activePurpose ? 1 : 0.5, transition: 'opacity 0.3s' }}>
                                    <UserFlowGraph
                                        pages={project.pages}
                                        links={project.links}
                                        activePersona={activePersona}
                                        userFlowUrls={activePurpose ? (project.userFlows?.[activePersona.name]?.[activePurpose]?.urls || []) : []}
                                    />
                                </div>
                            </>
                        )}

                        {/* No personas generated yet */}
                        {!activePersona && !project.personas?.length && (
                            <div style={{
                                textAlign: 'center',
                                padding: '4rem 2rem',
                                background: '#f8fafc',
                                borderRadius: '12px',
                                border: '2px dashed #e2e8f0'
                            }}>
                                <Users size={48} style={{ color: '#94a3b8', marginBottom: '1rem' }} />
                                <h3 style={{ marginBottom: '0.5rem' }}>No Personas Generated Yet</h3>
                                <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                                    Click "Generate AI Analysis" to create user personas and flows
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {view === 'pageflow' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 className="page-title" style={{ fontSize: '1.8rem', marginBottom: 0 }}>Page Flow Details</h2>
                        </div>
                        <div className="card" style={{ padding: 0, overflow: 'hidden', height: '600px' }}>
                            <PageFlowGraph pages={project.pages} links={project.links} />
                        </div>
                    </div>
                )}

                {view === 'broken' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 className="page-title" style={{ fontSize: '1.8rem', marginBottom: 0 }}>Broken Links</h2>
                            <button onClick={() => {
                                const headers = ['Target URL', 'Source Page', 'Status'];
                                const rows = project.brokenLinks.map(l => [l.url, l.source, l.status]);
                                const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                                downloadCSV(csvContent, 'broken_links.csv');
                            }} className="btn" style={{ fontSize: '0.9rem' }}>Export CSV</button>
                        </div>
                        {project.brokenLinks && project.brokenLinks.length > 0 ? (
                            <div className="card">
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                                            <th style={{ padding: '0.5rem' }}>Target URL</th>
                                            <th style={{ padding: '0.5rem' }}>Source Page</th>
                                            <th style={{ padding: '0.5rem' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {project.brokenLinks.map((link, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '0.5rem', color: '#e11d48' }}>{link.url}</td>
                                                <td style={{ padding: '0.5rem' }}>
                                                    <a href={link.source} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                                                        {link.source ? new URL(link.source).pathname : 'Unknown'}
                                                    </a>
                                                </td>
                                                <td style={{ padding: '0.5rem' }}>{link.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="card">
                                <p>No broken links found.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;