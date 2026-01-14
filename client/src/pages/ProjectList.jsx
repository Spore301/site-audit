import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight } from 'lucide-react';
import API_BASE_URL from '../config';

const ProjectList = () => {
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/projects`)
            .then(res => res.json())
            .then(data => setProjects(data))
            .catch(err => console.error(err));
    }, []);

    const deleteProject = (id) => {
        if (!confirm('Are you sure you want to delete this project?')) return;

        fetch(`${API_BASE_URL}/api/projects/${id}`, { method: 'DELETE' })
            .then(res => {
                if (res.ok) {
                    setProjects(projects.filter(p => p.id !== id));
                }
            })
            .catch(err => console.error(err));
    };

    return (
        <div className="container" style={{ paddingTop: '4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="page-title" style={{ marginBottom: 0 }}>My Projects</h1>
                <Link to="/new" className="btn btn-primary">
                    <Plus size={18} style={{ marginRight: '0.5rem' }} />
                    New Audit
                </Link>
            </div>

            {projects.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>No audits yet</h3>
                    <p style={{ color: '#666', marginBottom: '2rem' }}>Start your first website audit to see the sitemap and user flow.</p>
                    <Link to="/new" className="btn btn-primary">Create Project</Link>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {projects.map(project => (
                        <div key={project.id} className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ fontWeight: 600 }}>{project.domain}</span>
                                <span style={{
                                    padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem',
                                    background: project.status === 'completed' ? '#dcfce7' : '#f3f4f6',
                                    color: project.status === 'completed' ? '#166534' : '#374151'
                                }}>{project.status}</span>
                            </div>
                            <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                {project.pages.length} pages scanned
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Link to={`/project/${project.id}/${project.status === 'completed' ? 'dashboard' : 'scanning'}`} style={{ display: 'flex', alignItems: 'center', color: 'var(--color-primary)', fontSize: '0.9rem', fontWeight: 500 }}>
                                    View Report <ArrowRight size={16} style={{ marginLeft: '0.25rem' }} />
                                </Link>
                                <button onClick={(e) => { e.preventDefault(); deleteProject(project.id); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProjectList;
