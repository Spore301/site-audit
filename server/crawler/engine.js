const { chromium } = require('playwright');
const { normalizeConfig } = require('../utils/urlHelper');
const Project = require('../models/Project');

// Helper to update project via Sequelize
const updateProject = async (projectId, data) => {
    try {
        await Project.update(data, {
            where: { id: projectId }
        });
    } catch (error) {
        console.error(`[Data] Failed to update project ${projectId}:`, error);
    }
};

const startScan = async (projectId, startUrl) => {
    console.log(`[Crawl] Starting scan for ${startUrl} (Project: ${projectId})`);
    await updateProject(projectId, { status: 'scanning' });

    const MAX_PAGES = 100;

    let browser;
    try {
        console.log('[Crawl] Launching browser...');
        browser = await chromium.launch({
            args: ['--no-sandbox']
        });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();
        console.log('[Crawl] Browser launched. Context created.');

        const visited = new Set();
        const queue = [{ url: startUrl, source: null }];
        const baseDomain = normalizeConfig(startUrl);

        const pages = [];
        const links = [];
        const brokenLinks = [];

        while (queue.length > 0 && visited.size < MAX_PAGES) {
            let { url: currentUrl, source } = queue.shift();

            // Normalize currentUrl
            try {
                const u = new URL(currentUrl);
                if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
                    u.pathname = u.pathname.slice(0, -1);
                }
                currentUrl = u.href;
            } catch (e) { }

            if (visited.has(currentUrl)) {
                console.log(`[Crawl] Skipping already visited: ${currentUrl}`);
                continue;
            }
            visited.add(currentUrl);

            console.log(`[Crawl] Visiting (${visited.size}/${MAX_PAGES}): ${currentUrl}`);

            try {
                const response = await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Handle Initial Redirect (Domain Forwarding)
                // If it's the start URL and we ended up somewhere else with a different domain
                if (currentUrl === startUrl && response) {
                    const finalUrl = response.url();
                    const finalDomain = normalizeConfig(finalUrl);

                    if (finalDomain !== baseDomain) {
                        console.log(`[Crawl] Detected redirect from ${startUrl} to ${finalUrl}. Updating base domain to: ${finalDomain}`);
                        baseDomain = finalDomain;
                    }
                }

                console.log(`[Crawl] Page loaded: ${currentUrl} (Status: ${response ? response.status() : 'No Response'})`);

                await page.waitForTimeout(1000);

                if (!response) {
                    if (source) brokenLinks.push({ url: currentUrl, source, status: 'No Response' });
                    continue;
                }

                const status = response.status();
                if (status >= 400) {
                    if (source) brokenLinks.push({ url: currentUrl, source, status });
                    continue;
                }

                const title = await page.title();
                pages.push({ url: currentUrl, title });

                if (source) {
                    links.push({ source, target: currentUrl });
                }

                console.log(`[Crawl] Extracting links from ${currentUrl}...`);
                const hrefs = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('a[href]'))
                        .map(a => {
                            try {
                                return new URL(a.href, document.baseURI).href;
                            } catch (e) { return null; }
                        })
                        .filter(href => href);
                });
                console.log(`[Crawl] Found ${hrefs.length} raw links on ${currentUrl}`);

                let newLinksCount = 0;

                for (let href of hrefs) {
                    href = href.split('#')[0];
                    if (href.endsWith('/') && href.split('/').length > 3) {
                        href = href.slice(0, -1);
                    }

                    const cleanHref = href.split('?')[0];

                    // 1. HARD IGNORE: Images, Scripts, Styles, Fonts, Archives (Keep ignoring these)
                    if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|ico|woff|woff2|ttf|eot|zip|rar|tar|gz|mp4|mp3)$/i.test(cleanHref)) {
                        continue;
                    }

                    // 2. LEAF NODES: Documents (PDF, DOC, etc.) - Add to Graph, BUT DO NOT CRAWL
                    const isDocument = /\.(pdf|docx|doc|xls|xlsx|ppt|pptx)$/i.test(cleanHref);

                    try {
                        const linkUrl = new URL(href);
                        const linkDomain = linkUrl.hostname.replace(/^www\./, '');

                        if (linkDomain === baseDomain) {
                            const exists = links.find(l => l.source === currentUrl && l.target === href);
                            if (!exists && href !== currentUrl) {
                                console.log(`[Link] Found: ${href} ${isDocument ? '(Document)' : '(Page)'}`);
                                links.push({ source: currentUrl, target: href });
                            }

                            // Only add to crawl queue if it's NOT a document and NOT already visited
                            if (!isDocument && !visited.has(href)) {
                                const inQueue = queue.some(q => q.url === href);
                                if (!inQueue) {
                                    queue.push({ url: href, source: currentUrl });
                                    newLinksCount++;
                                    console.log(`[Queue] Added: ${href}`);
                                } else {
                                    // console.log(`[Queue] Skipped (Already in queue): ${href}`);
                                }
                            } else if (isDocument) {
                                console.log(`[Link] Document Found: ${href}`);
                                // Add to pages list so it shows in Sitemap and Graph
                                const docExists = pages.find(p => p.url === href);
                                if (!docExists) {
                                    const filename = href.split('/').pop();
                                    pages.push({ url: href, title: `[DOC] ${filename}`, type: 'document' });
                                }
                            }
                        }
                    } catch (e) { }
                }
                console.log(`[Crawl] Added ${newLinksCount} new unique internal links to queue.`);

                // Periodic update to DB
                if (visited.size % 5 === 0) {
                    await updateProject(projectId, { pages, links, brokenLinks });
                }

            } catch (err) {
                console.error(`[Crawl] Failed to crawl ${currentUrl}: ${err.message}`);
                if (source) brokenLinks.push({ url: currentUrl, source, status: 'Error: ' + err.message });
            }
        }

        console.log(`[Crawl] Scan completed. Scanned ${visited.size} pages.`);
        await updateProject(projectId, {
            status: 'completed',
            pages,
            links,
            brokenLinks
        });

    } catch (error) {
        console.error('[Crawl] Fatal error:', error);
        await updateProject(projectId, { status: 'failed', error: error.message });
    } finally {
        if (browser) await browser.close();
    }
};

module.exports = { startScan };
