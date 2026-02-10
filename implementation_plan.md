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

# User Persona Implementation Plan

## Goal
Transform the "User Flow" graph from a noisy all-encompassing sitemap into targeted, actionable user journeys based on specific personas (e.g., "Job Seeker", "Investor", "Customer").

## Architecture
We will use a local **Ollama** model (e.g., `llama3`, `mistral`) to analyze the crawled sitemap and deduce likely personas and their relevant paths. We will continue using **React Flow** for the visualization.

### 1. Backend (`/server`)
- **No External Dependency**: Use native `fetch` to call local Ollama API.
- **Database**: Add `personas` column (JSON) to `Project` model.
- **New Endpoint**: `POST /api/projects/:id/analyze-personas`
  - **Input**: Project ID.
  - **Process**:
    1.  Fetch all scanned pages (`url`, `title`).
    2.  **Call Ollama**: POST to `http://localhost:11434/api/generate`.
    3.  **Prompt**: "Analyze these URLs and return a JSON list of 3-5 key user personas (e.g., Investor, Customer) with their relevant page paths."
    4.  **Parsing**: robustly parse likely non-perfect JSON from small models.
    5.  Save results to DB and return.

### 2. Frontend (`/client`)
- **Dashboard UI**:
    - Add "Generate Personas (Ollama)" button.
    - Add **Persona Selector** dropdown.
- **Graph Logic (`UserFlowGraph.jsx`)**:
    - **Library**: Continue using **React Flow**.
    - **Filtering**:
        - Receive `activePersona` prop.
        - If active, filter `nodes` array to only show pages in the persona's list.
        - Filter `edges` to ensure connectivity is maintained or just show direct links between visible nodes.
        - **Layout**: Re-run Dagre layout on the filtered subset so the graph looks clean (not just a sparse version of the big graph).

## Proposed Workflow
1.  User clicks **"Generate Personas"** in Dashboard.
2.  Backend sends Sitemap -> Ollama (Local).
3.  Ollama returns JSON (e.g., `[{ name: "Investor", pages: [...] }]`).
4.  User selects "Investor" from dropdown.
5.  Graph re-renders showing only investor-relevant pages and flows.

## Requirements
- **Ollama** running locally on port 11434.
- Model pulled (e.g., `ollama pull llama3`).

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
