const axios = require('axios');

/**
 * Service for generating user flows for each persona
 * Maps relevant pages from the sitemap to each persona's journey
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const GEMMA_API_KEY = process.env.GEMMA_API_KEY;
const GEMMA_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent';

/**
 * Prepare a compact representation of pages for the AI
 * Reduces token usage while preserving key information
 */
function preparePagesForAI(pages, maxPages = 50) {
    // Sort pages by importance (home page first, then shorter URLs = higher level)
    const sortedPages = [...pages].sort((a, b) => {
        if (a.url.endsWith('/') || a.url.endsWith('.com') || a.url.endsWith('.org')) return -1;
        if (b.url.endsWith('/') || b.url.endsWith('.com') || b.url.endsWith('.org')) return 1;
        return a.url.split('/').length - b.url.split('/').length;
    });

    // Take a representative sample
    const sample = sortedPages.slice(0, maxPages);

    return sample.map(p => ({
        url: p.url,
        title: p.title?.slice(0, 80) || '',
        pageType: p.pageType || 'content',
        h1: p.h1?.slice(0, 60) || '',
        ctas: p.ctas?.slice(0, 2) || []
    }));
}

/**
 * Prepare prompt for user flow generation
 */
function prepareUserFlowPrompt(siteSummary, personas, pages) {
    const compactPages = preparePagesForAI(pages);

    return `Create user journey flows for each persona on this website.

SITE CONTEXT:
- Type: ${siteSummary.siteType}
- Industry: ${siteSummary.industry}
- Purpose: ${siteSummary.purpose}

PERSONAS AND PURPOSES:
${JSON.stringify(personas.map(p => ({ name: p.name, purposes: p.userGoals })))}

AVAILABLE PAGES:
${JSON.stringify(compactPages.map(p => p.url))}

IMPORTANT: Return ONLY a valid JSON object. No explanatory text, no markdown, no comments.

JSON format (keys are persona names, values are objects mapping each purpose to a URL array):
{
    "Persona Name": {
        "First Goal": ["url1", "url2", "url3"],
        "Second Goal": ["url1", "url4", "url5"]
    }
}

Rules:
- Generate a distinct user flow for EVERY purpose listed for the persona.
- Use only URLs from the available pages list
- Each flow should have 2-6 URLs
- First URL is the entry point

Return ONLY the JSON object, nothing else.`;
}

/**
 * Call Ollama API
 */
async function callOllama(prompt) {
    console.log('[AI] Calling Ollama (kimi-k2.5:cloud) for user flow generation...');
    const response = await axios.post(OLLAMA_URL, {
        model: process.env.OLLAMA_MODEL || 'kimi-k2.5:cloud',
        prompt: prompt,
        stream: false,
        format: 'json',
        options: {
            temperature: 0.5,
            num_ctx: 8192
        }
    }, {
        timeout: 300000
    });

    let responseText = response.data.response;
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(responseText);
}

/**
 * Call Gemma 4 26B
 */
async function callGemma(prompt) {
    console.log('[AI] Calling Gemma 4 26B A4B IT for user flow generation...');

    const url = `${GEMMA_URL}?key=${GEMMA_API_KEY}`;

    const response = await axios.post(url, {
        contents: [{
            role: 'user',
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature: 0.5,
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

    // Find JSON object
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
        text = text.slice(jsonStart, jsonEnd + 1);
    }

    text = text.trim();
    console.log('[AI] Cleaned JSON:', text.slice(0, 300));

    return JSON.parse(text);
}

/**
 * Generate user flows for all personas
 */
async function generateUserFlows(siteSummary, personas, pages) {
    if (!siteSummary || !personas || !pages) {
        throw new Error('siteSummary, personas, and pages are all required');
    }

    const prompt = prepareUserFlowPrompt(siteSummary, personas, pages);

    try {
        let flows;
        // Prioritize local Ollama model
        if (!GEMMA_API_KEY || process.env.OLLAMA_MODEL) {
            flows = await callOllama(prompt);
        } else {
            flows = await callGemma(prompt);
        }

        // Validate and enrich flows
        const validUrls = new Set(pages.map(p => p.url));
        const enrichedFlows = {};

        for (const personaName of Object.keys(flows)) {
            const purposeObject = flows[personaName];

            if (typeof purposeObject !== 'object' || Array.isArray(purposeObject)) continue;

            enrichedFlows[personaName] = {};
            const persona = personas.find(p => p.name === personaName);

            for (const purposeName of Object.keys(purposeObject)) {
                const urlList = purposeObject[purposeName];
                if (!Array.isArray(urlList)) continue;

                // Filter to only valid URLs and remove duplicates while preserving order
                const uniqueUrls = [];
                const seen = new Set();

                for (const url of urlList) {
                    const normalized = url.split('#')[0]; // Remove hash
                    if (validUrls.has(url) && !seen.has(normalized)) {
                        uniqueUrls.push(url);
                        seen.add(normalized);
                    }
                }

                if (uniqueUrls.length >= 2) {
                    enrichedFlows[personaName][purposeName] = {
                        urls: uniqueUrls,
                        steps: uniqueUrls.length,
                        entryPoint: uniqueUrls[0],
                        exitPoint: uniqueUrls[uniqueUrls.length - 1],
                        persona: persona || { name: personaName },
                        purpose: purposeName
                    };
                }
            }
            
            // Cleanup empty persona objects
            if (Object.keys(enrichedFlows[personaName]).length === 0) {
                delete enrichedFlows[personaName];
            }
        }

        console.log(`[AI] Generated user flows for ${Object.keys(enrichedFlows).length} personas`);
        return enrichedFlows;

    } catch (error) {
        console.error('[AI] Failed to generate user flows:', error.message);
        // Return simple heuristic-based flows
        return generateFallbackFlows(personas, pages);
    }
}

/**
 * Fallback flow generation using heuristics
 */
function generateFallbackFlows(personas, pages) {
    const flows = {};
    const homePage = pages.find(p => p.url.endsWith('/') || /\.(com|org|net)\/?$/.test(p.url));
    const productPages = pages.filter(p => p.pageType === 'product' || p.url.includes('product'));
    const contactPages = pages.filter(p => p.url.includes('contact') || p.pageType === 'contact');

    for (const persona of personas) {
        const flow = [homePage?.url].filter(Boolean);

        // Add relevant pages based on persona type
        const name = persona.name.toLowerCase();

        if (name.includes('buyer') || name.includes('shopper') || name.includes('customer')) {
            if (productPages.length > 0) {
                flow.push(productPages[0].url);
                if (productPages.length > 1) flow.push(productPages[1].url);
            }
        }

        if (name.includes('support') || name.includes('contact')) {
            if (contactPages.length > 0) flow.push(contactPages[0].url);
        }

        if (flow.length >= 2) {
            flows[persona.name] = {};
            const firstGoal = persona.userGoals && persona.userGoals.length > 0 ? persona.userGoals[0] : 'General Browsing';
            
            flows[persona.name][firstGoal] = {
                urls: flow,
                steps: flow.length,
                entryPoint: flow[0],
                exitPoint: flow[flow.length - 1],
                persona: persona,
                purpose: firstGoal,
                fallback: true
            };
        }
    }

    return flows;
}

module.exports = { generateUserFlows };