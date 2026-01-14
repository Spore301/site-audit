# Implementation Plan - Site Audit Tool V1

## Goal Description
Build a site audit platform that provides a sitemap, user flow diagram, and broken link detection for a given website. The tool will handle dynamic websites, offer visual mapping, and support PDF export.

## Proposed Tech Stack
- **Frontend**: React (Vite) + Vanilla CSS
    - *Reasoning*: React allows for complex state management (dashboard) and rich visualization libraries. Vanilla CSS ensures lightweight, fully custom styling as per user preference.
- **Backend**: Node.js (Express) + Playwright
    - *Reasoning*: Node.js shares the language with frontend. Playwright is excellent for crawling dynamic websites.
- **Architecture**:
    - **Client**: Single Page Application (SPA).
    - **Server**: REST API to handle crawl jobs and **Project storage**.
    - **Storage**: `projects.json` (V1 simple persistence) or in-memory.

## User Review Required
> [!IMPORTANT]
> **Data Persistence**: For V1, we will save projects to a local JSON file (`server/data/projects.json`) so they persist between server restarts. This avoids setting up a full database (SQL/Mongo) for now, keeping it "Basic" but functional.

> [!NOTE]
> **Color Theme**:
> - **Primary (CTA)**: `#1e7ddf` (Blue)
> - **Ink**: Black
> - **Background**: White

## Proposed Changes

### Project Structure
```text
/
├── client/         # React Frontend
├── server/         # Express Backend
├── server/data/    # JSON storage
└── package.json    # Root scripts
```

### Backend (Server)
#### [NEW] server/index.js
- Entry point.
- Express app setup.
- Routes: `/api/projects` (List/Create), `/api/scan`, `/api/sse`, `/api/result`.

#### [NEW] server/controllers/projectController.js
- `getProjects()`: Read from `projects.json`.
- `createProject(domain)`: Create entry, trigger logic.

#### [NEW] server/crawler/engine.js
- **Technology**: Playwright.
- **Logic**:
    - Launch browser.
    - Navigate to root URL.
    - Breadth-First Search (BFS) to discover links.
    - Track:
        - `pages`: List of visited URLs.
        - `links`: `source` -> `target`.
        - `broken_links`: 404s.
    - Respect limits for V1.

#### [NEW] server/utils/urlHelper.js
- Normalization logic.

### Frontend (Client)
#### [NEW] client/src/main.jsx & App.jsx
- Routing setup (React Router).
- Routes:
    - `/` (Projects List - Landing)
    - `/new` (New Project Input)
    - `/project/:id/scanning` (Loader)
    - `/project/:id/dashboard` (Result)

#### [NEW] client/src/styles/index.css
- Global variables:
    - `--color-primary: #1e7ddf;`
    - `--color-ink: #000000;`
    - `--color-bg: #ffffff;`
- Reset CSS.
- "Premium" aesthetic styles (clean, high contrast, smooth UI).

#### [NEW] client/src/pages/ProjectList.jsx
- Landing page.
- Lists existing projects (cards/list).
- "New Project" button (Primary CTA).

#### [NEW] client/src/pages/NewProject.jsx
- (Formerly Onboarding)
- Centered input field for Domain.
- "Start Audit" button.

### User Flow Export (Image, PDF, Figma)
- Use `html-to-image` to generate PNG of the ReactFlow graph.
- Use `jspdf` for high-quality PDF export (embedding the graph image).
- Use `html-to-image` (`toSvg`) for **Figma Export**. This creates a vector SVG file that can be dragged directly into Figma.
- [Modify] `client/src/components/UserFlowGraph.jsx`: Add "Export for Figma" button.

#### [NEW] client/src/pages/Loader.jsx
- Visual progress bar.
- Polls backend or listens to SSE for specific project ID.

#### [NEW] client/src/pages/Dashboard.jsx
- Layout with Sidebar and Main Content Area.

#### [NEW] client/src/components/SitemapView.jsx
- Tree or List view of `pages`.

#### [NEW] client/src/components/UserFlowView.jsx
- Use a graph library (e.g., `reactflow` or `vis-network`) to render the `pages` nodes and `links` edges.

#### [NEW] client/src/components/BrokenLinksView.jsx
- Table/List of broken links with source page reference.

## Verification Plan
### Automated Tests
- Basic unit tests for URL normalization.
- Backend API tests using formatted mock requests.

### Manual Verification
1. **Onboarding**: Input `https://example.com` and verify it starts.
2. **Crawling**: Use a controlled test site or a small public site. Verify it captures links.
3. **Broken Links**: Test with a known broken link URL (if available) or mock the response.
4. **Visuals**: Check if the User Flow diagram renders nodes and connections correctly.
5. **PDF**: Click export and verify the PDF is generated and readable.
