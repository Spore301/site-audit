import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config';

const Loader = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('initializing');

    useEffect(() => {
        const interval = setInterval(() => {
            fetch(`${API_BASE_URL}/api/projects/${id}`)
                .then(res => res.json())
                .then(data => {
                    setStatus(data.status);
                    if (data.status === 'completed') {
                        navigate(`/project/${id}/dashboard`);
                    }
                })
                .catch(err => console.error(err));
        }, 2000);

        return () => clearInterval(interval);
    }, [id, navigate]);

    return (
        <div className="loader-container">
            <div className="spinner"></div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Scanning Website...</h2>
            <p style={{ color: '#666' }}>Status: {status}</p>
        </div>
    );
};

export default Loader;
