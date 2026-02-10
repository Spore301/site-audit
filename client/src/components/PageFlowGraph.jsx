import React, { useMemo } from 'react';
import { toPng } from 'html-to-image';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    useReactFlow,
    ReactFlowProvider,
    Position,
    Handle,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

// Node for Source Page
const SourcePageNode = ({ data }) => {
    return (
        <div style={{
            background: '#fff',
            border: '2px solid #334155',
            borderRadius: '8px',
            minWidth: '280px',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            fontSize: '12px',
            overflow: 'visible' // Ensure handles aren't clipped
        }}>
            {/* Header */}
            <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid #cbd5e1',
                background: '#f1f5f9',
                fontWeight: 700,
                color: '#0f172a',
                fontSize: '14px',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px'
            }}>
                {data.label}
            </div>

            {/* Sections */}
            {['nav', 'content', 'footer'].map(section => {
                const sectionLinks = data.links[section] || [];
                if (sectionLinks.length === 0) return null;

                const sectionTitle = section === 'nav' ? 'Navigation' : section === 'footer' ? 'Footer' : 'Main Content';
                const sectionBg = section === 'nav' ? '#f8fafc' : section === 'footer' ? '#f8fafc' : '#fff';
                const sectionColor = section === 'content' ? '#000' : '#64748b';

                return (
                    <div key={section} style={{ padding: '8px', background: sectionBg, borderBottom: section !== 'footer' ? '1px solid #f1f5f9' : 'none' }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>{sectionTitle}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {sectionLinks.map((link) => (
                                <div key={link.id}
                                    id={`cta-${link.id}`} // DOM ID for potential alignment checks if needed
                                    style={{
                                        position: 'relative',
                                        padding: '8px 10px',
                                        background: '#fff',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        color: sectionColor,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        height: '35px', // Fixed height for easier calculation
                                        boxSizing: 'border-box'
                                    }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px', fontWeight: 500 }} title={link.text}>
                                        {link.text || 'Link'}
                                    </span>
                                    {/* Output Handle */}
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={link.id}
                                        style={{ background: '#64748b', right: '-14px', width: '8px', height: '8px', border: '2px solid white' }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
            {(Object.keys(data.links).every(k => data.links[k].length === 0)) && (
                <div style={{ padding: '1rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>No outgoing links</div>
            )}
        </div>
    );
};

// Simple Node for Target Pages
const TargetPageNode = ({ data }) => {
    return (
        <div style={{
            background: '#fff',
            border: '1px solid #94a3b8',
            borderRadius: '6px',
            padding: '8px 12px',
            minWidth: '200px',
            height: '35px', // Match CTA height
            boxSizing: 'border-box',
            fontSize: '12px',
            color: '#334155',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        }}>
            <Handle type="target" position={Position.Left} style={{ background: '#64748b', width: '8px', height: '8px', border: '2px solid white' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }} title={data.fullLabel}>
                {data.label}
            </span>
        </div>
    );
};

const nodeTypes = {
    sourcePageNode: SourcePageNode,
    targetPageNode: TargetPageNode
};

const getClusterElements = (pages, links, activePersona) => {
    let rawNodes = [];
    let rawEdges = [];

    const COLUMNS = 2;
    const X_GAP = 700; // Wider gap for aligned targets
    const Y_GAP = 120;

    // Filter Pages
    let filteredPages = pages;
    if (activePersona && activePersona.pages) {
        const personaPageSet = new Set(activePersona.pages.map(p => {
            try { return new URL(p, 'http://dummy.com').pathname; } catch (e) { return p; }
        }));
        filteredPages = pages.filter(p => {
            try {
                const u = new URL(p.url).pathname;
                return personaPageSet.has(u) || activePersona.pages.includes(p.url);
            } catch (e) { return false; }
        });
    }

    // --- 1. GLOBAL NAVIGATION CLUSTER ---
    // Extract unique Nav/Footer links from the first few pages (assuming consistent Site Nav)
    const globalLinks = { nav: [], footer: [] };
    const seenGlobalLinks = new Set();

    // Scan first 3 pages to gather comprehensive nav/footer
    filteredPages.slice(0, 3).forEach(page => {
        const pageLinks = links.filter(l => l.source === page.url);
        pageLinks.forEach(link => {
            const context = link.context || 'content';
            if (context === 'nav' || context === 'footer') {
                const key = `${context}-${link.target}-${link.text}`;
                if (!seenGlobalLinks.has(key)) {
                    seenGlobalLinks.add(key);
                    // Create a pseudo-ID
                    globalLinks[context].push({ ...link, id: `global-${key.replace(/[^a-zA-Z0-9]/g, '')}` });
                }
            }
        });
    });

    let currentY = 0;

    if (globalLinks.nav.length > 0 || globalLinks.footer.length > 0) {
        // Create Global Node
        const globalSourceId = 'global-source';
        // Height Calc: Header(43) + Pad(8*2) + Title(20) + Links*(35+8)
        let gHeight = 43;
        if (globalLinks.nav.length) gHeight += 40 + (globalLinks.nav.length * 43);
        if (globalLinks.footer.length) gHeight += 40 + (globalLinks.footer.length * 43);

        rawNodes.push({
            id: globalSourceId,
            type: 'sourcePageNode',
            position: { x: X_GAP / 2, y: currentY }, // Center it?
            data: { label: 'GLOBAL NAVIGATION & FOOTER', links: { ...globalLinks, content: [] }, url: null },
            style: { border: '2px solid #6366f1' } // Distinct style
        });

        // Global Targets (1-to-1)
        // Calculating correct Y positions
        // Nav Starts at: Header(43) + SectionHead(30ish) + Pad... 
        // Best way: Track Y offset relative to node top

        let globalTargetY = currentY + 43; // Skip Header

        ['nav', 'footer'].forEach(section => {
            const slinks = globalLinks[section];
            if (slinks.length > 0) {
                globalTargetY += 40; // Section padding/header approx
                slinks.forEach((link, idx) => {
                    // Create Target
                    const tId = `global-target-${link.id}`;
                    let tLabel = '/';
                    try { const u = new URL(link.target); tLabel = u.pathname; } catch (e) { }
                    if (tLabel.length > 25) tLabel = '...' + tLabel.slice(-22);

                    rawNodes.push({
                        id: tId,
                        type: 'targetPageNode',
                        position: { x: (X_GAP / 2) + 350, y: globalTargetY + 6 }, // +6 to align center with 35px btn
                        data: { label: tLabel, fullLabel: link.target, url: link.target }
                    });

                    rawEdges.push({
                        id: `e-${link.id}`,
                        source: globalSourceId,
                        target: tId,
                        sourceHandle: link.id,
                        type: 'straight', // Straight horizontal line
                        style: { stroke: '#cbd5e1', strokeWidth: 2 },
                        animated: false
                    });

                    globalTargetY += 43; // 35px height + 8px gap
                });
            }
        });

        currentY += gHeight + Y_GAP;
    }


    // --- 2. INDIVIDUAL PAGE CLUSTERS (CONTENT ONLY) ---
    // 2-Column Layout
    let colY = [currentY, currentY];

    filteredPages.forEach((page, index) => {
        const col = index % 2;
        const xPos = col * X_GAP;
        const yPos = colY[col];

        // Filter Links: Content Only
        const pageLinks = links.filter(l => l.source === page.url && l.source !== l.target);
        const contentLinks = [];

        pageLinks.forEach((link, i) => {
            // Treat undefined as content if scan is old, but strict logic prefers 'content'
            const context = link.context || 'content';
            if (context === 'content') {
                contentLinks.push({ ...link, id: `${page.url}-${link.target}-${i}` });
            }
        });

        // Source Node
        const sourceId = `source-${index}`;

        // Height Calc:
        // Header(43)
        // Content Section: Padding/Title(40) + Links(43 each)
        // Plus padding 20
        const contentHeight = 40 + (contentLinks.length * 43);
        const nodeHeight = 43 + contentHeight + 20;

        let label = '/';
        try { const u = new URL(page.url); label = u.pathname; } catch (e) { }
        if (label.length > 30) label = '...' + label.slice(-27);
        if (label === '/') label = 'Home';

        rawNodes.push({
            id: sourceId,
            type: 'sourcePageNode',
            position: { x: xPos, y: yPos },
            data: { label, links: { nav: [], footer: [], content: contentLinks }, url: page.url }
        });

        // 1-to-1 Targets
        const targetStartX = xPos + 350;
        let relativeY = 43 + 40; // Skip Header + Section Title

        contentLinks.forEach((link) => {
            const rawTLabel = link.target;
            let tLabel = '/';
            try { const u = new URL(rawTLabel); tLabel = u.pathname; } catch (e) { }
            if (tLabel.length > 25) tLabel = '...' + tLabel.slice(-22);

            const targetId = `target-${link.id}`; // 1-to-1 mapping by using Link ID

            // Align Y: 
            // SourceNode Y + relativeY + slight offset for border/padding alignment
            // The CTA is at relativeY inside the source.
            // CTA height = 35. Target height = 35. Should align perfectly at same Y if relativeY matches.
            // The `padding: 8px 10px` in CTA wrapper inside map loop implies:
            // The loop adds `currentY += 43;` (35 content + 8 gap)

            rawNodes.push({
                id: targetId,
                type: 'targetPageNode',
                position: { x: targetStartX, y: yPos + relativeY + 4 }, // +4 tweak for exact center alignment?
                data: { label: tLabel, fullLabel: rawTLabel, url: rawTLabel }
            });

            rawEdges.push({
                id: `e-${link.id}`,
                source: sourceId,
                target: targetId,
                sourceHandle: link.id,
                type: 'straight', // Straight line
                style: { stroke: '#94a3b8', strokeWidth: 1.5 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
            });

            relativeY += 43; // Increment for next link
        });

        // Update Col Y
        const clusterHeight = Math.max(nodeHeight, relativeY + 50);
        colY[col] += clusterHeight + 80;
    });

    return { nodes: rawNodes, edges: rawEdges };
};

const PageFlowGraph = ({ pages, links, activePersona }) => {
    const { nodes, edges } = useMemo(() => {
        if (!pages || !links) return { nodes: [], edges: [] };
        return getClusterElements(pages, links, activePersona);
    }, [pages, links, activePersona]);

    const [nodesState, setNodes, onNodesChange] = useNodesState(nodes);
    const [edgesState, setEdges, onEdgesChange] = useEdgesState(edges);
    const { fitView } = useReactFlow();

    React.useEffect(() => {
        setNodes(nodes);
        setEdges(edges);
    }, [nodes, edges, setNodes, setEdges]);

    const downloadImage = () => {
        const flowElement = document.querySelector('.react-flow');
        if (!flowElement) return;
        toPng(flowElement, { backgroundColor: '#f8fafc' }).then((dataUrl) => {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'page-flow-refined.png';
            a.click();
        });
    };

    return (
        <div style={{ width: '100%', height: '800px', border: '1px solid #eee', borderRadius: '12px', background: '#f8fafc', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: '0.5rem' }}>
                <button onClick={downloadImage} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#fff', border: '1px solid #ddd' }}>
                    Export PNG
                </button>
            </div>
            <ReactFlow
                nodes={nodesState}
                edges={edgesState}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                onNodeClick={(_, node) => {
                    if (node.data && node.data.url) {
                        window.open(node.data.url, '_blank');
                    }
                }}
                minZoom={0.1}
            >
                <Controls />
                <Background color="#e2e8f0" gap={40} size={1} />
            </ReactFlow>
        </div>
    );
};

const PageFlowGraphWrapper = (props) => (
    <ReactFlowProvider>
        <PageFlowGraph {...props} />
    </ReactFlowProvider>
);

export default PageFlowGraphWrapper;
