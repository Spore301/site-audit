import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProjectList from './pages/ProjectList';
import NewProject from './pages/NewProject';
import Loader from './pages/Loader';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/new" element={<NewProject />} />
          <Route path="/project/:id/scanning" element={<Loader />} />
          <Route path="/project/:id/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
