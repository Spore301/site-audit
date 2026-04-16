# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Site Audit Tool that crawls websites to generate sitemaps, user flow diagrams, and broken link reports. Built with React (Vite) frontend and Node.js/Express backend using Playwright for crawling.

## Development Commands

### Client (React + Vite)
```bash
cd client
npm install
npm run dev          # Start dev server (Vite)
npm run build        # Production build
npm run lint         # ESLint
npm run preview      # Preview production build
```

### Server (Express + SQLite)
```bash
cd server
npm install
npm run dev          # Start with nodemon (ignores data/)
```

### Full Stack
There is no root-level dev script. Run client and server in separate terminals.

## Architecture

### Tech Stack
- **Frontend**: React 19 + React Router DOM + React Flow (graphs) + html-to-image + jspdf
- **Backend**: Express + Playwright (crawler) + Sequelize ORM + SQLite
- **AI Feature**: Local Ollama API (port 11434) for persona analysis

### Project Structure
```
site-audit/
├── client/               # React SPA
│   ├── src/
│   │   ├── pages/        # ProjectList, NewProject, Loader, Dashboard
│   │   ├── components/   # UserFlowGraph, PageFlowGraph
│   │   └── config.js     # API_BASE_URL (localhost:3000)
│   └── package.json
├── server/               # Express API
│   ├── index.js          # Entry, route setup
│   ├── controllers/
│   │   └── projectController.js  # Main business logic
│   ├── crawler/
│   │   └── engine.js     # Playwright BFS crawler
│   ├── models/
│   │   └── Project.js    # Sequelize model
│   ├── config/
│   │   └── database.js   # SQLite setup
│   ├── utils/
│   │   └── urlHelper.js  # URL normalization
│   └── data/             # SQLite database (gitignored)
└── package.json          # Root (minimal, just jspdf)
```

### Data Model (Sequelize)
The `Project` model stores:
- `id`: UUID primary key
- `url`, `domain`: Crawl target
- `status`: pending | scanning | completed | failed
- `pages`: JSON array of {url, title, type}
- `links`: JSON array of {source, target, text, context}
- `brokenLinks`: JSON array of {url, source, status}
- `personas`: JSON array from Ollama analysis

### API Endpoints
- `GET /api/projects` - List all projects (sorted by createdAt DESC)
- `POST /api/projects` - Create new project, triggers background crawl
- `GET /api/projects/:id` - Get project with full crawl results
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/analyze-personas` - Call Ollama to generate user personas
- `GET /api/projects/:id/download-documents` - ZIP download of PDF/DOCX files

### Crawler Behavior
Located in `server/crawler/engine.js`:
- Uses Playwright Chromium with `--no-sandbox`
- BFS crawl with `MAX_PAGES = 100` limit
- Tracks pages, links (with text and context: nav/footer/content), broken links
- Ignores: images, scripts, styles, fonts (by extension)
- Documents (PDF/DOCX/etc) are captured but not crawled
- Handles redirects and normalizes URLs (removes trailing slashes)
- Updates DB periodically during crawl for live progress

### Frontend Routes
- `/` - Projects list (landing)
- `/new` - Create new audit
- `/project/:id/scanning` - Shows crawl progress
- `/project/:id/dashboard` - Results with 4 views: Sitemap, User Flow, Page Flow, Broken Links

### Configuration
- **Client**: `client/src/config.js` exports `API_BASE_URL` (default: http://localhost:3000)
- **Server**: `server/config/database.js` configures SQLite at `server/data/database.sqlite`

## Important Implementation Details

### AI Persona Analysis
The `analyzePersonas` controller sends the sitemap to a local Ollama instance (llama3:latest) with a predefined set of 5 e-commerce personas. Requires Ollama running on localhost:11434.

### Graph Visualization
Uses React Flow with Dagre for automatic layout. Two graph components:
- `UserFlowGraph`: High-level site structure
- `PageFlowGraph`: Detailed page connections with link text

### Export Features
- **Sitemap**: Export to CSV
- **Broken Links**: Export to CSV
- **Documents**: Bulk download as ZIP (streams files, includes error entries for failed downloads)
- **Graphs**: PNG/PDF export via html-to-image and jspdf

### Database
SQLite with `sequelize.sync({ alter: true })` on startup. The `data/` directory is gitignored and also ignored by nodemon to prevent restart loops.
