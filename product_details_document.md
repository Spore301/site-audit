# Product Details Document: Site Audit Tool

## Table of Contents
1. [Product Overview](#1-product-overview)
2. [Product Vision and Scope](#2-product-vision-and-scope)
3. [User Roles and Personas](#3-user-roles-and-personas)
4. [Information Architecture](#4-information-architecture)
5. [End-to-End User Flows](#5-end-to-end-user-flows)
6. [Feature Inventory](#6-feature-inventory)
7. [Screen / Page-by-Page Breakdown](#7-screen--page-by-page-breakdown)
8. [Component and UI System Breakdown](#8-component-and-ui-system-breakdown)
9. [Data Model and Domain Model](#9-data-model-and-domain-model)
10. [API and Backend Behavior](#10-api-and-backend-behavior)
11. [Authentication and Authorization](#11-authentication-and-authorization)
12. [Business Logic](#12-business-logic)
13. [Content and Copy Behavior](#13-content-and-copy-behavior)
14. [Validation and Edge Cases](#14-validation-and-edge-cases)
15. [Integrations and External Services](#15-integrations-and-external-services)
16. [State Management and App Architecture](#16-state-management-and-app-architecture)
17. [Environment, Deployment, and Config](#17-environment-deployment-and-config)
18. [Observability and Analytics](#18-observability-and-analytics)
19. [Future Scope and Roadmap](#19-future-scope-and-roadmap)
20. [Open Questions](#20-open-questions)
21. [Traceability Appendix](#21-traceability-appendix)
22. [Project Summary](#22-project-summary)

---

## 1. Product Overview
- **Product name**: Site Audit Tool
- **One-line description**: An automated web crawling and AI-analysis application designed to map website architecture, diagnose broken links, and generate actionable user journey flows.
- **Core purpose**: To accelerate technical and UX audits by systematically scraping a target website and simulating target demographics (personas) using generative AI.
- **Problem it solves**: Manual website mapping and UX flow testing are highly time-consuming. This tool automates the process of discovering pages, documenting link relationships, verifying link health, and intelligently grouping the data to answer user-centric goals.
- **Target users**: UX Researchers, SEO Specialists, Product Managers, and Web Developers.
- **Business objectives**: Reduce turnaround time for site audit deliverables, improve site health via automated link checks, and offer unique AI insights for optimization.

## 2. Product Vision and Scope
- **What the product does**: Automatically crawls a given root URL up to 100 internal pages, identifies links and their DOM locations (header, footer, content), finds broken links, detects downloadable documents (PDF, DOCX), captures semantic metadata, and delegates this data to an LLM to generate personas and probable user journeys. Displays results in interactive, exportable network graphs.
- **What it does not do**: It does not crawl behind authentication walls, execute complex stateful interactions (like completing multi-step forms), bypass Captchas, or map site architectures larger than the hard-coded 100-page limit.
- **Current scope based on the codebase**: Fully functional single-tenant web app leveraging Express, Playwright, React Flow, and Large Language Models (Gemma/Ollama).
- **Future Scope**: Transforming the prototype into a scalable, multi-tenant SaaS. This includes adding authentication, introducing strict job queuing for crawler resource management, migrating the database schema for concurrency, and implementing telemetry (see Section 19).

## 3. User Roles and Personas
- **All identified user types (System Users)**: 
  - *Auditor/Operator* (Primary): The user interacting with the UI to initiate and review scans. Access is unrestricted; there are no permission boundaries present in the code.
- *(Inferred)* **Target Application Personas**: The system generates synthetic personas using LLMs based on the scanned target website (e.g., "The Browser", "The Quick Buyer", "The Evaluator"). These exist purely as data points within a project analysis.
- **Permissions and access levels**: **Unclear/Missing**. Unrestricted public access; anyone hitting the frontend can trigger scans and delete projects.

## 4. Information Architecture
- **Site Map / App Map**:
  - `/` -> Projects Dashboard (Landing Page)
  - `/new` -> Initiation Form for New Audits
  - `/project/:id/scanning` -> Transitional polling view during active crawler jobs
  - `/project/:id/dashboard` -> Audit Results with 4 sub-views:
    1. Sitemap Table
    2. Persona Flows
    3. Page Flow
    4. Broken Links
- **Navigation structure**: Flat, sidebar-based configuration when viewing specific project outputs. Use of standard breadcrumb/back mechanisms to return to the project inventory.

## 5. End-to-End User Flows

### Flow 1: Create Audit & Wait for Completion
- **Entry point**: `/new` (New Project Screen)
- **Preconditions**: Node server is running with Playwright access.
- **Step-by-step interaction**:
  1. User enters a root website URL (e.g., `https://example.com`) and clicks "Start Audit".
  2. UI sends `POST /api/projects`; server immediately creates project row with status `pending`.
  3. Server dispatches an asynchronous `crawlEngine.startScan()` Playwright job.
  4. UI redirects to `/project/:id/scanning`. 
  5. The Loader component polls the server `GET /api/projects/:id` every 2000ms.
  6. The crawler updates the database incrementally. The UI counters tick up showing the number of pages found.
- **Success path**: The crawler finishes, status changes to `completed`, and the UI automatically routes to `/project/:id/dashboard`.
- **Failure states**: Crawler hits a fatal exception, status changes to `failed`, error message is logged/saved.
- **Empty states**: Invalid input is ignored by the front-end validation.

### Flow 2: View and Analyze Results
- **Entry point**: `/project/:id/dashboard`
- **Preconditions**: Project must be in `completed` state.
- **Step-by-step interaction**:
  1. User views the generic Sitemap and raw Page Flow graph.
  2. User clicks "Generate AI Analysis".
  3. UI sends `POST /api/projects/:id/analyze-personas`.
  4. Server performs 3 synchronous LLM calls (Summarize -> Generate Personas -> Generate Flow Paths) sequentially.
  5. UI receives new data, updates sidebar with Personas.
  6. User clicks a Persona, then clicks a distinct Goal (e.g. "Check ROI").
  7. The interactive User Flow map highlights only the steps to achieve that goal.
  8. User exports the map to PDF or Figma SVG.

## 6. Feature Inventory

| Feature | Purpose | How it works | Dependencies | UI Surfaces | Edge cases | Status |
|---|---|---|---|---|---|---|
| **Headless Crawler** | Extract URLs, semantic data, and links | Playwright opens a browser context, executes JS to extract DOM insights, checks links, handles redirects. Breadth-First Search queue. | Playwright Chromium | `Loader.jsx` | 100 page limit. Hangs on infinite redirect. Single domain checking. | Implemented |
| **Document Archiver** | Download linked PDFs, DOCX | Aggregates all URLs matching document regex and downloads them server-side, zipping via `archiver`. | Axios, Archiver | Dashboard Sitemap | Broken links during DL are added to an error text file. | Implemented |
| **Site AI Summarizer** | Understand business domain | Randomly samples max 30 crawl pages, strips noise, formats to token-efficient JSON, prompts LLM for target audience and features. | Ollama / GenAI API | Dashboard Sidebar | Sub-optimal parsing on generic templates. JSON markdown stripping relies on regex. | Implemented |
| **Persona AI Generator**| Synthesize user segments | Takes the Site Summary metadata and prompts LLM to output 4-6 distinct, formatted user profiles. | Ollama / GenAI API | Dashboard Persona Tabs | Failsafe mechanism provides hardcoded default profiles if LLM fails. | Implemented |
| **User Flow AI Mapper** | Identify navigational intents | Passes all discovered URLs + specific Persona + specific Persona Goal into an LLM to hallucinate valid sequential step-paths. | Ollama / GenAI API | Dashboard ReactFlow | Empty flow results or hallucinates paths not in actual site nav. Generates heuristic paths as a fallback on failure. | Implemented |
| **Graph Visualizer** | Present architectures | React Flow handles viewport and edges. Dagre library handles automatic grid/hierarchical layout processing. | React Flow, Dagre | Canvas/Main Area | Large sites freeze layout engine or make edge overlaps unreadable. Vectors exporting uses hacky CSS print injection. | Implemented |

## 7. Screen / Page-by-Page Breakdown

### ProjectList (`/`)
- **Purpose**: Inventory of past audits.
- **Main components**: Grid array of Project cards, `+ New Audit` button.
- **User actions**: View report, delete report.
- **States**: Empty state ("No audits yet"), populated list.

### NewProject (`/new`)
- **Purpose**: Intake form for URL.
- **Main components**: Centered input box, submit button.
- **States**: Loading (button disabled during post), idle.
- **Validation**: Will not submit if input is functionally empty.

### Loader (`/project/:id/scanning`)
- **Purpose**: Hold user attention while async backend task progresses.
- **Main components**: Spinner, scanned page counter.
- **States**: Initializing -> Scanning -> Auto-Redirects.

### Dashboard (`/project/:id/dashboard`)
- **Purpose**: Primary interactive analytics interface.
- **Main components**: Left Sidebar (Navigation & AI controls), Main Canvas (Data view).
- **User actions**: Toggle views (Sitemap/Flow/PageFlow/Broken), trigger AI, isolate persona goals, export data.
- **Responsive behavior**: Hard-coded structural layouts. Side panels are fixed widths (`280px`), main panels flex. It's built for desktop analytics usage.

## 8. Component and UI System Breakdown
- **Reusable components**: `UserFlowGraph.jsx`, `PageFlowGraph.jsx`.
- **Layout patterns**: App shell model (Persistent left sidebar, varying right flexbox).
- **Design system clues**: Uses `lucide-react` for consistent iconography. Buttons use `.btn` and `.btn-primary`. Standardized borders and shadows indicate a utility-first CSS approach or raw stylesheets reflecting modern generic SaaS aesthetics.
- **Modals/Alerts**: System relies heavily on native browser tools (`confirm()`, `alert()`).

## 9. Data Model and Domain Model

**Entity: Project**
Stored via Sequelize SQLite database (`server/models/Project.js`).
- `id` (UUID): Primary Key.
- `url` (String): Raw input URL.
- `domain` (String): Normalized root domain.
- `status` (String): `pending | scanning | completed | failed`.
- `pages` (JSON Array): `{url, title, type, h1, h2s, ctas, pageType, metaDescription}`. Contains semantic scraped data.
- `links` (JSON Array): `{source, target, text, context: 'nav'|'footer'|'content'}`. Contains cross-references.
- `brokenLinks` (JSON Array): `{url, source, status}`.
- `personas` (JSON Array): Output array from AI schema constraint.
- `siteSummary` (JSON): Object detailing audience, tone, complexity.
- `userFlows` (JSON): Nested object mapping persona goals to arrays of URLs to complete those goals.

*Note: Heavy reliance on document-style JSON arrays inside a SQL context.*

## 10. API and Backend Behavior
- **`GET /api/projects`**: Lists all projects sorted DESC by creation date.
- **`POST /api/projects`**: Normalizes URL, spins up database row, invokes background `crawlEngine.startScan()`. Returns 201 immediately with project ID.
- **`GET /api/projects/:id`**: Primary polling endpoint for UI hydration. Returns full project JSON payload.
- **`DELETE /api/projects/:id`**: Wipes SQLite record. Returns 404 if missing.
- **`GET /api/projects/:id/download-documents`**: Streams an on-the-fly zip archive mapping to the `axios` GET pipes. Continues partial zipping if individual downloads fail, emitting failure text files inside the zip root.
- **`POST /api/projects/:id/analyze-personas`**: Multi-stage synchronous API. Runs stages sequentially: Summary, Personas, Flow. Determines if cachebusting (`?force=true`) applies. Timeouts configured natively in axios up to 300,000ms.

## 11. Authentication and Authorization
- **Status**: **Planned for Future Scope**.
- **Login/signup flows**: Currently none.
- **Boundaries**: None. All API routes and internal resources are 100% accessible to any user hitting the server interfaces. Implementing user accounts and tenant boundaries is a priority roadmap item.

## 12. Business Logic
- **Crawl Boundaries**: `engine.js` maintains a `visited` Set with a strict `MAX_PAGES = 100` ceiling to prevent infinite loops. Outbound external links are inherently avoided.
- **Redirects**: Tracks base internal domains. If the original root redirects (e.g. `http://a.com` to `https://b.com`), the tool intelligently shifts its "internal domain" strict definition to `b.com`.
- **Link Exclusion**: Uses RegEx strictly ignoring images/assets `\.(jpg|css|js|ico|woff...)` and selectively captures document leaf nodes `\.(pdf|docx)` preventing them from entering the standard page traversal queue.
- **AI Engine Selection**: Prioritizes local `OLLAMA_MODEL` if running via env config bounds, implicitly defaulting to Google Gemma remote APIs via `GEMMA_API_KEY` otherwise.
- **Data Reduction via DOM**: Extracts text, headings strictly via simplified querySelectors. Predicts pageType via regex-like class inspection (e.g., matching `.cart`, `.pricing` class labels).

## 13. Content and Copy Behavior
- **Reusable text patterns**: Clean grammatical tone focused on instruction.
- **Empty state copy**: "No audits yet", "Start your first website audit", "Select a Purpose". 
- **AI System Prompts**: Leverage explicitly structured formatting patterns ("Return ONLY a valid JSON array") to coerce models efficiently.
- **Hard Fallbacks**: Persona generation handles AI failure outputs gracefully returning mock profiles. E-commerce default: "The Quick Buyer", "The Browser", "The Deal Hunter". 

## 14. Validation and Edge Cases
- **Crawler Resilience**: Handles timeouts (`30000ms`), normalizes URLs aggressively (strips trailing slashes and hash fragments without discarding semantic target parameters). 
- **LLM Fences**: Regex scrubbing handles common LLM failure outputs (e.g., removing ` ```json ` blocks bounding strings, discarding explanatory padding text, finding the innermost JSON bracket). 
- **Offline / Failure Handling**: No robust retry protocols on API disruption. If initial Playwright loading fails entirely, project is set to `failed` and user must recreate.

## 15. Integrations and External Services
- **Playwright Chromium Engine**: Embedded server-side headless browser emulation. Allows for parsing client-side JavaScript sites effectively.
- **Ollama API Framework**: Local AI interfacing integration, pointing defaults to `localhost:11434`.
- **Google Generative AI**: External API fallback using Gemma 4 26b architectures via `generativelanguage.googleapis.com`.
- **React Flow**: Third-party framework mapping HTML visual node relationships.
- **Dagre**: Directed acyclic graph execution solver handling visual routing geometry.
- **Archiver & axios**: Node utilities for fetching sequential HTTP streams and converting them to Zlib instances.
- **html-to-image & jsPDF**: Client-side conversion plugins parsing DOM to binary formats inline via canvas injection.

## 16. State Management and App Architecture
- **State strategy**: Distributed via persistence mechanism. The source of truth relies completely on iterative updates inside SQLite. 
- **Global state**: Minimal. Handled explicitly via `useState` and native context API. No dedicated state orchestrators (Redux). 
- **Async flows**: The background crawler job is inherently "fire-and-forget", requiring front-end manual interval polling loops to sync DB states. Controller memory runs hot.
- **Cache Strategy**: Non-existent beyond browser fetch semantics. LLM outputs are persistently written to the DB columns bypassing immediate LLM reprocessing unless `?force=true` query bounds are enabled.

## 17. Environment, Deployment, and Config
- **Build Setup**: Vite proxy mechanism configuration mapping client origins (`localhost:5173`) routing implicitly to the backend port (`3000`).
- **ENV variables**: Configurations strictly mapping `OLLAMA_URL`, `GEMMA_API_KEY`, `OLLAMA_MODEL`.
- **Data Persistence**: Uses a local `.sqlite` file generated dynamically in code (`server/data/database.sqlite`) driven via Sequelize `sync({ alter: true })`. 
- **Deployment assumptions**: Requires dual-process deployment models; both an HTTP server supporting Node runtime frameworks, and a statically served UI layer.

## 18. Observability and Analytics
- **Logging**: Console output strictly localized (`console.log`, `console.error`) serving as ad-hoc tracing mechanics (`[Crawl] Page loaded: ...`).
- **Monitoring/Telemetry**: **Planned for Future Scope**. Introducing APM hooks, error reporting suites (e.g. Sentry/Datadog), and standardized structuring wrappers (Winston/Pino) are required for production scaling.

## 19. Future Scope and Roadmap
The following items have been identified as architectural limits, missing features, or scalability risks in the current iteration. They form the immediate future scope for achieving production-readiness:

### 19.1 Security & Access
- **Authentication & Authorization**: Implement robust user accounts (e.g., JWT, OAuth) to secure the application. Create tenant boundaries so users securely own and view only their audits.
- **Network Boundaries (SSRF Protection)**: Implement strict URL parsing constraints to block scanning of internal IPs (e.g., `localhost`, `169.254.x.x`) or local network hostnames to prevent Server-Side Request Forgery vulnerabilities in the crawler.

### 19.2 Scalability & Architecture
- **Job Queuing System**: Introduce a dedicated background queue manager (like Redis and BullMQ) to handle `chromium.launch` executions. This will strictly limit active concurrent scans and prevent fatal Out-of-Memory (OOM) host container crashes when multiple audits are requested.
- **Relational Data Mapping**: Migrate away from storing 100+ nested JSON structures inside monolithic SQLite string rows. Re-architect the data model to use proper relational tables (e.g., `Pages`, `Links`, `Personas`) or migrate to a native document database (MongoDB) to avoid `SQLITE_BUSY` locking under high concurrency.
- **Observability Infrastructure**: Add standardized structured logging (Pino/Winston) and an APM/telemetry integration (Sentry/Datadog) to effectively track crawler failures, trace bottlenecks, and monitor LLM success rates.

### 19.3 Performance & UI Enhancements
- **Graph Layout Optimization**: Implement rendering optimizations (e.g., Web Workers for Dagre layout calculations, node clustering, or pagination) for architecture graphs exceeding 100+ nodes to stabilize browser main thread performance on lower-end devices.
- **Configurable Crawl Limits**: Add UI configurations allowing users to adjust the default 100-page threshold and specify URL exclusion rules or boundary limits for the documents scraper. 

## 20. Open Questions
- Is user authentication natively planned prior to public usage parameters?
- How should internal request domain spoofings be natively blocked effectively? 
- Will the default 100-page threshold be parametized as a user-configurable slider mechanism?
- Does the "documents" scraper require explicit scope boundaries scaling files matching massive binary downloads via axios? 

## 21. Traceability Appendix
For developers referring back to architecture scopes:
- **Scraping Core**: `server/crawler/engine.js` -> Maps Playwright HTTP navigation sequences.
- **AI Mechanics**: `server/services/*.js` -> Handles the parsing methodologies overriding LLM architectures contexts.
- **Data Schemas**: `server/models/Project.js` -> Main SQLite logic handler mapping.
- **Graph UIs**: `client/src/components/PageFlowGraph.jsx` and `UserFlowGraph.jsx` -> Core canvas nodes drawing mechanisms utilizing ReactFlow layouts.
- **Exporting Modules**: Embedded directly utilizing inline references in `Dashboard.jsx`. 

---

## 22. Project Summary

The Site Audit Tool serves as an intelligent, automated SEO and UX structural scanner engineered for web administrators and project analysts. Operating through an Express API scaling atop headless Chromium drivers (Playwright), the project processes designated namespaces simulating logical end-site navigations traversing DOM elements dynamically. The app distills extensive navigation maps, isolates distinct HTTP error codes via Broken Links reports, and aggregates standard textual documents natively to downloadable instances.

Beyond its foundational crawling capabilities, the tool incorporates experimental Generative AI mechanisms (bridging remote Gemma integrations or local Ollama engines) tasked with simulating structural semantic properties. Synthesizing random samples of crawled targets enables the software to hallucinate accurate business domains naturally, generating demographic "personas" scaling hypothetical navigation "flows". The future scope of the project focuses on evolving from a capable single-tenant prototype into a production-ready SaaS application by addressing core scalability requirements—specifically introducing robust authentication, migrating to scalable relational/document data models, and implementing background queuing for browser orchestration.
