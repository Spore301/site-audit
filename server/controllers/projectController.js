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

const archiver = require('archiver');
const axios = require('axios');

// ... imports remain the same, adding imports at top conceptually, but here I'll just add the function before module.exports

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
            // If headers sent, we can't do much but end response, but archiver handles piping.
            if (!res.headersSent) res.status(500).send({ error: err.message });
        });

        archive.pipe(res);

        for (const doc of documents) {
            try {
                const url = doc.url;
                const response = await axios.get(url, { responseType: 'stream' });

                // Create a filename structure
                let filename = url.replace(/^https?:\/\/[^\/]+/, '');
                if (filename.startsWith('/')) filename = filename.slice(1);

                // Decode URI components to handle spaces/special chars in URL
                try {
                    filename = decodeURIComponent(filename);
                } catch (e) { }

                archive.append(response.data, { name: filename });
            } catch (error) {
                console.error(`Failed to download ${doc.url}:`, error.message);
                archive.append(Buffer.from(`Failed to download: ${doc.url}\nError: ${error.message}`), { name: `errors/failed-${Math.random().toString(36).substr(7)}.txt` });
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

        // Simplify pages list for prompt to save context window
        // 1. Shuffle pages to get a random representative sample (avoid alphabetical bias)
        const shuffledPages = pages.sort(() => 0.5 - Math.random());
        // 2. Limit to top 60 pages to balance context size and speed (local inference optimization)
        const pageList = shuffledPages.slice(0, 60).map(p => p.url).join('\n');

        const ECOMMERCE_SCENARIOS = [
            {
                name: "The Mission-Oriented Buyer",
                description: "Knows exactly what they want. Lands, searches/navigates directly to product, adds to cart, and checks out quickly."
            },
            {
                name: "The Window Shopper",
                description: "Just browsing. Looks at homepage, maybe a category page, clicks a few products, checks blog/about, but leaves without buying."
            },
            {
                name: "The Researcher",
                description: "Comparing options. Reads product details deeply, checks specs, reviews, and perhaps compares multiple items."
            },
            {
                name: "The Support Seeker",
                description: "Looking for help. Visits contact us, FAQ, shipping info, returns policy, or help center."
            },
            {
                name: "The Returning Customer",
                description: "Returning user. Logs in, checks order history, profile settings, or wishlist."
            }
        ];

        const prompt = `You are a UX Expert. We have defined the following 5 E-Commerce User Personas (Scenarios):

${JSON.stringify(ECOMMERCE_SCENARIOS, null, 2)}

Your task is to analyze the following list of website URLs and map a **LOGICAL USER FLOW** for **ALL 5** of the above personas.

For **EACH** of the 5 personas provided above:
1. Keep the name and description exactly as provided.
2. Create a "pages" array with 2-5 RELEVANT URLs from the provided list, representing the sequence of their journey.
3. Use ONLY URLs from the provided list.

Return ONLY a valid JSON ARRAY containing exactly 5 objects.
Format:
[
  {
    "name": "The Mission-Oriented Buyer",
    "description": "...",
    "pages": ["url1", "url2"]
  },
  ...
]

Do not include markdown formatting or explanation. output must start with [.

URLs:
${pageList}`;

        console.log('[AI] Sending request to Ollama (llama3:latest)...');

        // Call local Ollama
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "llama3:latest",
            prompt: prompt,
            stream: false,
            format: "json",
            options: {
                temperature: 0.3, // Lower temperature for more consistent/logical flows
                num_ctx: 4096 // Reduced context for speed
            }
        }, {
            timeout: 300000 // 5 minutes timeout
        });

        let responseText = response.data.response;
        console.log('[AI] Received response:', responseText.substring(0, 100) + '...');

        // Clean up response if it contains markdown code blocks
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        let personas = [];
        try {
            // Attempt 1: Direct Parse
            personas = JSON.parse(responseText);
        } catch (e) {
            console.log('[AI] Direct parse failed, trying regex extraction...');
            // Attempt 2: Extract JSON array using regex
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    personas = JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    console.error('[AI] Regex extraction parse failed:', e2);
                }
            } else {
                console.error('[AI] No JSON array found in response.');
            }
        }

        // Validate personas structure
        if (!Array.isArray(personas)) {
            // Did it return a single object?
            if (typeof personas === 'object' && personas !== null && personas.name && personas.pages) {
                console.log('[AI] Received single persona object, wrapping in array.');
                personas = [personas];
            } else {
                console.error('[AI] Invalid structure or empty:', personas);
                console.error('[AI] Raw Response:', responseText);
                return res.status(500).json({ error: 'AI returned invalid structure (not array)', raw: responseText });
            }
        }

        if (personas.length === 0) {
            return res.status(500).json({ error: 'AI returned empty array', raw: responseText });
        }

        // Save to DB
        await project.update({ personas });

        res.json(personas);

    } catch (error) {
        console.error('Error analyzing personas:', error);
        res.status(500).json({ error: error.message || 'Failed to analyze personas' });
    }
};

module.exports = { getProjects, createProject, getProjectResult, deleteProject, downloadDocuments, analyzePersonas };
