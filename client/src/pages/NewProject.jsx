import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe } from 'lucide-react';
import API_BASE_URL from '../config';

const NewProject = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!url) return;
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            if (data.id) {
                navigate(`/project/${data.id}/scanning`);
            }
        } catch (error) {
            console.error('Failed to create project', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container page-header">
            <h1 className="page-title">New Site Audit</h1>
            <p className="page-subtitle">Enter the URL of the website you want to map and analyze.</p>

            <div className="card" style={{ maxWidth: '600px', margin: '3rem auto' }}>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label style={{ fontWeight: 500 }}>Website URL</label>
                        <div style={{ position: 'relative' }}>
                            <Globe size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                            <input
                                type="text"
                                className="input-field"
                                style={{ paddingLeft: '2.5rem', width: '100%' }}
                                placeholder="https://example.com"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Starting...' : 'Start Audit'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NewProject;
