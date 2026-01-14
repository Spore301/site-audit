import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ChevronLeft, Layout, GitGraph, AlertCircle } from 'lucide-react';
import UserFlowGraph from '../components/UserFlowGraph';
import API_BASE_URL from '../config';

const Dashboard = () => {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [view, setView] = useState('sitemap'); // sitemap, flow, broken

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/projects/${id}`)
            .then(res => res.json())
            .then(data => setProject(data));
    }, [id]);

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
            <aside style={{ width: '250px', background: '#f8f9fa', borderRight: '1px solid #e5e5e5', padding: '1.5rem', flexShrink: 0 }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>
                    <ChevronLeft size={16} /> Back to Projects
                </Link>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.domain}</h3>
                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '2rem' }}>{project.pages.length} Pages Scanned</div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button onClick={() => setView('sitemap')} className={`btn`} style={{ justifyContent: 'flex-start', background: view === 'sitemap' ? '#e2e8f0' : 'transparent', color: view === 'sitemap' ? 'black' : '#666' }}>
                        <Layout size={18} style={{ marginRight: '0.5rem' }} /> Sitemap
                    </button>
                    <button onClick={() => setView('flow')} className={`btn`} style={{ justifyContent: 'flex-start', background: view === 'flow' ? '#e2e8f0' : 'transparent', color: view === 'flow' ? 'black' : '#666' }}>
                        <GitGraph size={18} style={{ marginRight: '0.5rem' }} /> User Flow
                    </button>
                    <button onClick={() => setView('broken')} className={`btn`} style={{ justifyContent: 'flex-start', background: view === 'broken' ? '#e2e8f0' : 'transparent', color: view === 'broken' ? 'black' : '#666' }}>
                        <AlertCircle size={18} style={{ marginRight: '0.5rem' }} /> Broken Links
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, padding: '2rem', overflow: 'auto', background: '#fff' }}>
                {view === 'sitemap' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 className="page-title" style={{ fontSize: '1.8rem', marginBottom: 0 }}>Sitemap</h2>
                            <button onClick={() => {
                                const headers = ['URL', 'Title', 'Type'];
                                const rows = project.pages.map(p => [p.url, p.title, p.type || 'page']);
                                const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                                downloadCSV(csvContent, 'sitemap.csv');
                            }} className="btn" style={{ fontSize: '0.9rem' }}>Export CSV</button>
                        </div>
                        <div className="card">
                            {(() => {
                                // Group pages by category (first folder segment)
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
                        <h2 className="page-title" style={{ fontSize: '1.8rem' }}>User Flow</h2>
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <UserFlowGraph pages={project.pages} links={project.links} />
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
