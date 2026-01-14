const { URL } = require('url');

const normalizeUrl = (inputUrl) => {
    try {
        let urlStr = inputUrl.trim();
        if (!urlStr.startsWith('http')) {
            urlStr = 'https://' + urlStr;
        }
        const url = new URL(urlStr);
        // Remove trailing slash for consistency, unless it's root
        let href = url.href;
        if (href.endsWith('/') && url.pathname !== '/') {
            href = href.slice(0, -1);
        }
        return href;
    } catch (e) {
        return null;
    }
};

const getDomain = (inputUrl) => {
    const normalized = normalizeUrl(inputUrl);
    if (!normalized) return null;
    return new URL(normalized).hostname;
}

const normalizeConfig = (url) => {
    try {
        const u = new URL(url);
        return u.hostname.replace(/^www\./, '');
    } catch (e) { return ''; }
};

module.exports = { normalizeUrl, getDomain, normalizeConfig };
