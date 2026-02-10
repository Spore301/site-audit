const Project = require('./models/Project');
const axios = require('axios');
const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'data/database.sqlite'),
    logging: false
});

const testAnalysisLlama3 = async (projectId) => {
    try {
        console.log(`[Test] Fetching project ${projectId}...`);
        const project = await Project.findByPk(projectId);
        if (!project) {
            console.error('[Test] Project not found');
            return;
        }

        console.log(`[Test] Project found. Pages: ${project.pages ? project.pages.length : 0}`);
        const pages = project.pages || [];

        // REPLICATING THE FAIL CONDITION: 200 pages
        const shuffledPages = pages.sort(() => 0.5 - Math.random());
        const pageList = shuffledPages.slice(0, 200).map(p => p.url).join('\n');

        console.log(`[Test] Payload size: ${pageList.length} chars`);

        const prompt = `You are a UX Expert. Analyze the following list of website URLs and identify AT LEAST 3 distinct user personas based on the available pages.
        
For each persona, describe their goal and map out a LOGICAL USER FLOW. The "pages" array must be an ORDERED list of URLs representing the step-by-step journey they would take to achieve their goal (e.g., Home -> Product -> Cart -> Checkout).

Return ONLY valid JSON in the following format (an array of objects):
[
  {
    "name": "Persona Name",
    "description": "Description of the persona and their goal...",
    "pages": ["url_step_1", "url_step_2", "url_step_3"]
  },
  ...
]

Do not include markdown formatting or explanation. JUST THE JSON.

URLs:
${pageList}`;

        console.log('[Test] Sending request to Ollama (llama3:latest) with num_ctx: 8192...');
        const startTime = Date.now();

        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "llama3:latest",
            prompt: prompt,
            stream: false,
            format: "json",
            options: {
                temperature: 0.3,
                num_ctx: 8192 // The setting that might be causing issues
            }
        }, { timeout: 300000 }); // 5 min timeout

        const duration = (Date.now() - startTime) / 1000;
        console.log(`[Test] Response received in ${duration}s`);

        let responseText = response.data.response;
        // console.log('[Test] Raw Response:', responseText); // Commented out to reduce noise if huge

        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        let personas = [];
        try {
            personas = JSON.parse(responseText);
        } catch (e) {
            console.log('[Test] Direct parse failed, trying regex...');
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                personas = JSON.parse(jsonMatch[0]);
            } else {
                console.error('[Test] No JSON array found.');
            }
        }

        if (!Array.isArray(personas)) {
            if (typeof personas === 'object' && personas !== null && personas.name) {
                console.log('[Test] Single object wrapping...');
                personas = [personas];
            }
        }

        console.log('[Test] Parsed Personas Count:', personas.length);
        console.log('[Test] Success!');

    } catch (error) {
        console.error('[Test] FAILED:', error.message);
        if (error.code === 'ECONNABORTED') {
            console.error('[Test] Request timed out (exceeded 300000ms)');
        }
        if (error.response) {
            console.error('[Test] Ollama Status:', error.response.status);
            console.error('[Test] Ollama Data:', error.response.data);
        }
    }
};

// Initialize DB and run test
Project.init({
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
    url: { type: Sequelize.STRING, allowNull: false },
    domain: { type: Sequelize.STRING, allowNull: false },
    status: { type: Sequelize.STRING, defaultValue: 'pending' },
    pages: { type: Sequelize.JSON, defaultValue: [] },
    links: { type: Sequelize.JSON, defaultValue: [] },
    brokenLinks: { type: Sequelize.JSON, defaultValue: [] },
    error: { type: Sequelize.TEXT, allowNull: true },
    personas: { type: Sequelize.JSON, defaultValue: [] }
}, { sequelize, modelName: 'Project' });

sequelize.sync().then(() => {
    testAnalysisLlama3('cda3f3e2-14cb-4bc9-9db5-d794112f55f5');
});
