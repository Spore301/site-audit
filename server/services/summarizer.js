const axios = require('axios');

/**
 * Service for generating AI-powered summaries of crawled websites
 * Can use either Ollama (local) or Gemini (API) depending on config
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const GEMMA_API_KEY = process.env.GEMMA_API_KEY;
const GEMMA_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent';

/**
 * Prepare the prompt for site summarization
 * Uses a token-efficient approach: sample of pages with key info only
 */
function prepareSiteSummaryPrompt(pages) {
    // Select a representative sample of pages (max 30 to keep tokens low)
    // Prioritize diverse page types
    const sampleSize = Math.min(pages.length, 30);
    const sampledPages = pages.length > sampleSize
        ? pages.sort(() => 0.5 - Math.random()).slice(0, sampleSize)
        : pages;

    const pagesContext = sampledPages.map(p => ({
        url: p.url,
        title: p.title?.slice(0, 100) || '',
        h1: p.h1?.slice(0, 100) || '',
        headings: p.headings?.slice(0, 3) || [],
        pageType: p.pageType || 'content',
        ctas: p.ctas || []
    }));

    const prompt = `Analyze this website and provide a structured summary.

Website Pages:
${JSON.stringify(pagesContext, null, 2)}

IMPORTANT: Return ONLY a valid JSON object. No explanatory text, no markdown formatting, no comments.

Required JSON format:
{
    "siteType": "e-commerce|saas|blog|portfolio|corporate|marketplace|educational|news|other",
    "industry": "specific industry name",
    "purpose": "brief description of site's primary purpose",
    "targetAudience": ["audience 1", "audience 2", "audience 3"],
    "keyFeatures": ["feature 1", "feature 2", "feature 3", "feature 4"],
    "tone": "professional|casual|luxury|technical|friendly",
    "primaryActions": ["action 1", "action 2"],
    "complexity": "simple|medium|complex"
}

Return ONLY the JSON object, nothing else.`;

    return prompt;
}

/**
 * Call Ollama API (local, free)
 */
async function callOllama(prompt) {
    console.log('[AI] Calling Ollama (kimi-k2.5:cloud) for site summarization...');
    const response = await axios.post(OLLAMA_URL, {
        model: process.env.OLLAMA_MODEL || 'kimi-k2.5:cloud',
        prompt: prompt,
        stream: false,
        format: 'json',
        options: {
            temperature: 0.3,
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
 * Call Gemma 4 26B API
 */
async function callGemma(prompt) {
    console.log('[AI] Calling Gemma 4 26B A4B IT for site summarization...');

    const url = `${GEMMA_URL}?key=${GEMMA_API_KEY}`;

    try {
        const response = await axios.post(url, {
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.3,
                responseMimeType: 'application/json'
            }
        }, {
            timeout: 120000
        });

        let text = response.data.candidates[0].content.parts[0].text;
        console.log('[AI] Raw response:', text.slice(0, 300));

        // Clean up the response - extract JSON if wrapped in markdown or has extra text
        text = text.trim();

        // Remove markdown code blocks
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

        // If response has explanatory text before JSON, find the first {
        const jsonStart = text.indexOf('{');
        if (jsonStart > 0) {
            text = text.slice(jsonStart);
        }

        // Find the last } to handle trailing text
        const jsonEnd = text.lastIndexOf('}');
        if (jsonEnd > 0 && jsonEnd < text.length - 1) {
            text = text.slice(0, jsonEnd + 1);
        }

        text = text.trim();
        console.log('[AI] Cleaned JSON:', text.slice(0, 300));

        return JSON.parse(text);
    } catch (error) {
        console.error('[AI] Gemma API Error:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Generate site summary
 * Automatically selects provider based on available API keys
 */
async function generateSiteSummary(pages) {
    if (!pages || pages.length === 0) {
        throw new Error('No pages available for summarization');
    }

    const prompt = prepareSiteSummaryPrompt(pages);

    try {
        let summary;
        // Prioritize local Ollama model
        if (!GEMMA_API_KEY || process.env.OLLAMA_MODEL) {
            summary = await callOllama(prompt);
        } else {
            summary = await callGemma(prompt);
        }

        // Validate response structure
        const requiredFields = ['siteType', 'industry', 'purpose', 'targetAudience'];
        for (const field of requiredFields) {
            if (!summary[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        console.log('[AI] Site summary generated:', summary.siteType, '-', summary.industry);
        return summary;

    } catch (error) {
        console.error('[AI] Failed to generate site summary:', error.message);
        // Return a fallback summary
        return {
            siteType: 'unknown',
            industry: 'unknown',
            purpose: 'Unable to determine site purpose',
            targetAudience: ['Unknown'],
            keyFeatures: [],
            tone: 'unknown',
            primaryActions: [],
            complexity: 'unknown',
            error: error.message
        };
    }
}

module.exports = { generateSiteSummary };