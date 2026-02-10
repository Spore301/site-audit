const Project = require('./models/Project');
const axios = require('axios');
const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'data/database.sqlite'),
    logging: false
});

const testAnalysis = async (projectId) => {
    try {
        console.log(`[Test] Fetching project ${projectId}...`);
        const project = await Project.findByPk(projectId);
        if (!project) {
            console.error('[Test] Project not found');
            return;
        }

        console.log(`[Test] Project found. Pages: ${project.pages ? project.pages.length : 0}`);
        const pages = project.pages || [];

        // Limit to 50
        const pageList = pages.slice(0, 50).map(p => p.url).join('\n');

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

        console.log('[Test] Sending request to Ollama...');
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "llama3:latest",
            prompt: prompt,
            stream: false,
            format: "json",
            options: {
                temperature: 0.1,
                num_ctx: 4096
            }
        }, { timeout: 300000 });

        let responseText = response.data.response;
        console.log('[Test] Raw Response:', responseText);

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

        console.log('[Test] Parsed Personas:', JSON.stringify(personas, null, 2));

        if (!Array.isArray(personas)) {
            if (typeof personas === 'object' && personas !== null) {
                console.log('[Test] Received single object. Wrapping in array.');
                personas = [personas];
            } else {
                console.error('[Test] Invalid structure.');
                return;
            }
        }

        console.log('[Test] Updating database...');
        await project.update({ personas });
        console.log('[Test] Success!');

    } catch (error) {
        console.error('[Test] Error:', error);
    }
};

// Initialize DB and run test
// Project ID from user error: cda3f3e2-14cb-4bc9-9db5-d794112f55f5
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
    testAnalysis('cda3f3e2-14cb-4bc9-9db5-d794112f55f5');
});
