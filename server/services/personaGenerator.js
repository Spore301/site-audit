const axios = require('axios');

/**
 * Service for generating personas based on site summary
 * Uses site context to create relevant, specific user types
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const GEMMA_API_KEY = process.env.GEMMA_API_KEY;
const GEMMA_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent';

/**
 * Prepare prompt for persona generation
 * Uses site summary to create contextual, relevant personas
 */
function preparePersonaPrompt(siteSummary) {
    return `You are a UX research expert. Based on the following website summary, generate 4-6 realistic user personas.

SITE SUMMARY:
- Type: ${siteSummary.siteType}
- Industry: ${siteSummary.industry}
- Purpose: ${siteSummary.purpose}
- Target Audience: ${siteSummary.targetAudience?.join(', ') || 'Various'}

IMPORTANT: Return ONLY a valid JSON array. No explanatory text, no markdown, no comments.

Each persona must have this exact structure:
{
    "name": "Descriptive name like 'The Impulse Buyer'",
    "description": "Detailed description of who they are and motivations",
    "userGoals": ["goal 1", "goal 2", "goal 3"],
    "painPoints": ["pain point 1", "pain point 2"],
    "techSavvy": "low|medium|high",
    "visitFrequency": "first-time|occasional|regular"
}

Return ONLY the JSON array, nothing else.`;
}

/**
 * Call Ollama API
 */
async function callOllama(prompt) {
    console.log('[AI] Calling Ollama (kimi-k2.5:cloud) for persona generation...');
    const response = await axios.post(OLLAMA_URL, {
        model: process.env.OLLAMA_MODEL || 'kimi-k2.5:cloud',
        prompt: prompt,
        stream: false,
        format: 'json',
        options: {
            temperature: 0.7,
            num_ctx: 4096
        }
    }, {
        timeout: 300000
    });

    let responseText = response.data.response;
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(responseText);
}

/**
 * Call Gemma 4 26B via Google AI Studio
 */
async function callGemma(prompt) {
    console.log('[AI] Calling Gemma 4 26B A4B IT for persona generation...');

    const url = `${GEMMA_URL}?key=${GEMMA_API_KEY}`;

    const response = await axios.post(url, {
        contents: [{
            role: 'user',
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature: 0.7,
            responseMimeType: 'application/json'
        }
    }, {
        timeout: 120000
    });

    let text = response.data.candidates[0].content.parts[0].text;
    console.log('[AI] Raw response:', text.slice(0, 300));

    // Clean up the response
    text = text.trim();
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Find JSON array
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
        text = text.slice(jsonStart, jsonEnd + 1);
    }

    text = text.trim();
    console.log('[AI] Cleaned JSON:', text.slice(0, 300));

    return JSON.parse(text);
}

/**
 * Generate personas based on site summary
 */
async function generatePersonas(siteSummary) {
    if (!siteSummary) {
        throw new Error('Site summary required for persona generation');
    }

    const prompt = preparePersonaPrompt(siteSummary);

    try {
        let personas;
        // Prioritize local Ollama model
        if (!GEMMA_API_KEY || process.env.OLLAMA_MODEL) {
            personas = await callOllama(prompt);
        } else {
            personas = await callGemma(prompt);
        }

        // Ensure it's an array
        if (!Array.isArray(personas)) {
            if (personas.personas && Array.isArray(personas.personas)) {
                personas = personas.personas;
            } else {
                throw new Error('Invalid response format');
            }
        }

        // Validate each persona
        personas = personas.map(p => ({
            name: p.name || 'Unknown Persona',
            description: p.description || 'No description available',
            userGoals: p.userGoals || [],
            painPoints: p.painPoints || [],
            techSavvy: p.techSavvy || 'medium',
            visitFrequency: p.visitFrequency || 'first-time'
        }));

        console.log(`[AI] Generated ${personas.length} personas for ${siteSummary.siteType} site`);
        return personas;

    } catch (error) {
        console.error('[AI] Failed to generate personas:', error.message);
        // Return default personas based on site type
        return getDefaultPersonas(siteSummary.siteType);
    }
}

/**
 * Fallback default personas based on site type
 */
function getDefaultPersonas(siteType) {
    const defaults = {
        'e-commerce': [
            { name: 'The Quick Buyer', description: 'Knows what they want, makes fast decisions', userGoals: ['Find product', 'Checkout quickly'], painPoints: ['Slow checkout', 'Hidden fees'], techSavvy: 'high', visitFrequency: 'regular' },
            { name: 'The Browser', description: 'Casually looking, comparing options', userGoals: ['Explore products', 'Compare prices'], painPoints: ['Too many options', 'Decision fatigue'], techSavvy: 'medium', visitFrequency: 'occasional' },
            { name: 'The Deal Hunter', description: 'Looking for discounts and promotions', userGoals: ['Find deals', 'Apply coupons'], painPoints: ['Expired offers', 'Complicated discounts'], techSavvy: 'medium', visitFrequency: 'occasional' }
        ],
        'saas': [
            { name: 'The Evaluator', description: 'Researching solutions for their team', userGoals: ['Compare features', 'Check pricing', 'Read reviews'], painPoints: ['Unclear pricing', 'Missing features'], techSavvy: 'high', visitFrequency: 'first-time' },
            { name: 'The End User', description: 'Will be using the product daily', userGoals: ['Understand UX', 'Check integrations'], painPoints: ['Complex UI', 'Steep learning curve'], techSavvy: 'medium', visitFrequency: 'first-time' },
            { name: 'The Decision Maker', description: 'Has budget authority', userGoals: ['Check ROI', 'Enterprise features'], painPoints: ['No enterprise info', 'Slow support'], techSavvy: 'low', visitFrequency: 'first-time' }
        ],
        'blog': [
            { name: 'The Casual Reader', description: 'Browsing for entertainment or light learning', userGoals: ['Read articles', 'Share content'], painPoints: ['Paywalls', 'Slow loading'], techSavvy: 'medium', visitFrequency: 'occasional' },
            { name: 'The Researcher', description: 'Deep diving into specific topics', userGoals: ['Find in-depth content', 'References'], painPoints: ['Shallow content', 'Broken links'], techSavvy: 'high', visitFrequency: 'regular' }
        ]
    };

    return defaults[siteType] || [
        { name: 'The First-time Visitor', description: 'New to the site, exploring', userGoals: ['Understand offering', 'Navigate easily'], painPoints: ['Confusing navigation', 'Unclear value prop'], techSavvy: 'medium', visitFrequency: 'first-time' },
        { name: 'The Regular User', description: 'Familiar with the site', userGoals: ['Quick access to features', 'Efficiency'], painPoints: ['Slow loading', 'Broken features'], techSavvy: 'high', visitFrequency: 'regular' }
    ];
}

module.exports = { generatePersonas };
