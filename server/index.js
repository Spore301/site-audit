const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const projectController = require('./controllers/projectController');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Routes
app.get('/api/projects', projectController.getProjects);
app.post('/api/projects', projectController.createProject);
app.get('/api/projects/:id', projectController.getProjectResult);
app.delete('/api/projects/:id', projectController.deleteProject);

// Sync Database and Start Server
sequelize.sync().then(() => {
  console.log('Database synced');
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to sync database:', err);
});
