const Project = require('../models/Project');
const { normalizeUrl, getDomain } = require('../utils/urlHelper');
const crawlEngine = require('../crawler/engine');

const getProjects = async (req, res) => {
    try {
        const projects = await Project.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
};

const createProject = async (req, res) => {
    const { url } = req.body;
    const normalizedUrl = normalizeUrl(url);

    if (!normalizedUrl) {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    try {
        const newProject = await Project.create({
            url: normalizedUrl,
            domain: getDomain(normalizedUrl),
            status: 'pending'
        });

        // Trigger crawl in background
        crawlEngine.startScan(newProject.id, normalizedUrl);

        res.status(201).json(newProject);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
};

const getProjectResult = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await Project.findByPk(id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json(project);
    } catch (e) {
        console.error('Error fetching project:', e);
        res.status(500).json({ error: 'Failed to retrieve project' });
    }
};

const deleteProject = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await Project.destroy({
            where: { id }
        });
        if (result === 0) return res.status(404).json({ error: 'Project not found' });
        res.status(200).json({ message: 'Project deleted' });
    } catch (e) {
        console.error('Error deleting project:', e);
        res.status(500).json({ error: 'Failed to delete project' });
    }
};

module.exports = { getProjects, createProject, getProjectResult, deleteProject };
