const Project = require('../models/Project');
const { normalizeUrl, getDomain } = require('../utils/urlHelper');
const crawlEngine = require('../crawler/engine');
const { generateSiteSummary } = require('../services/summarizer');
const { generatePersonas } = require('../services/personaGenerator');
const { generateUserFlows } = require('../services/userFlowGenerator');

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

const archiver = require('archiver');
const axios = require('axios');

const downloadDocuments = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await Project.findByPk(id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const documents = (project.pages || []).filter(p => p.type === 'document');

        if (documents.length === 0) {
            return res.status(400).json({ error: 'No documents found to download' });
        }

        res.attachment(`${project.domain}-documents.zip`);
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        archive.on('error', err => {
            console.error('Archiver error:', err);
            if (!res.headersSent) res.status(500).send({ error: err.message });
        });

        archive.pipe(res);

        for (const doc of documents) {
            try {
                const url = doc.url;
                const response = await axios.get(url, { responseType: 'stream' });

                let filename = url.replace(/^https?:\/\/[^\/]+/, '');
                if (filename.startsWith('/')) filename = filename.slice(1);

                try {
                    filename = decodeURIComponent(filename);
                } catch (e) { }

                archive.append(response.data, { name: filename });
            } catch (error) {
                console.error(`Failed to download ${doc.url}:`, error.message);
                archive.append(Buffer.from(`Failed to download: ${doc.url}\nError: ${error.message}`), { name: `errors/failed-${Math.random().toString(36).slice(2)}.txt` });
            }
        }

        await archive.finalize();

    } catch (error) {
        console.error('Error downloading documents:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to process download' });
        }
    }
};

const analyzePersonas = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await Project.findByPk(id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const pages = project.pages || [];
        if (pages.length === 0) return res.status(400).json({ error: 'No pages found to analyze' });

        const force = req.query.force === 'true';

        let siteSummary = project.siteSummary;
        let personas = project.personas || [];
        let userFlows = project.userFlows || {};

        // STAGE 1: Generate Site Summary (if not exists)
        if (force || !siteSummary) {
            console.log('[AI] Stage 1: Generating site summary...');
            siteSummary = await generateSiteSummary(pages);
            await project.update({ siteSummary });
        } else {
            console.log('[AI] Using existing site summary:', siteSummary.siteType);
        }

        // STAGE 2: Generate Personas based on site summary (if not exists or empty)
        if (force || !personas || personas.length === 0) {
            console.log('[AI] Stage 2: Generating personas for', siteSummary.siteType, 'site...');
            personas = await generatePersonas(siteSummary);
            await project.update({ personas });
        } else {
            console.log(`[AI] Using existing ${personas.length} personas`);
        }

        // STAGE 3: Generate User Flows for each persona (if not exists)
        if (force || !userFlows || Object.keys(userFlows).length === 0) {
            console.log('[AI] Stage 3: Generating user flows for', personas.length, 'personas...');
            userFlows = await generateUserFlows(siteSummary, personas, pages);
            await project.update({ userFlows });
        } else {
            console.log(`[AI] Using existing user flows for ${Object.keys(userFlows).length} personas`);
        }

        // Return complete analysis
        res.json({
            siteSummary,
            personas,
            userFlows,
            totalPersonas: personas.length,
            flowsGenerated: Object.keys(userFlows).length
        });

    } catch (error) {
        console.error('Error analyzing personas:', error);
        res.status(500).json({ error: error.message || 'Failed to analyze personas' });
    }
};

module.exports = { getProjects, createProject, getProjectResult, deleteProject, downloadDocuments, analyzePersonas };