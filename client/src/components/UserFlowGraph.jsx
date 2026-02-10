import React, { useMemo } from 'react';
import { toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    useReactFlow,
    ReactFlowProvider,
    getRectOfNodes,
    getBezierPath,
    Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes, edges) => {
    dagreGraph.setGraph({ rankdir: 'TB' });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 150, height: 50 });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = 'top';
        node.sourcePosition = 'bottom';
        node.position = {
            x: nodeWithPosition.x - 75,
            y: nodeWithPosition.y - 25,
        };
        return node;
    });

    return { nodes, edges };
};

const UserFlowGraph = ({ pages, links, activePersona }) => {
    // State for layout direction: 'TB' (Top-Bottom) or 'LR' (Left-Right)
    const [direction, setDirection] = React.useState('TB');

    const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {

        let filteredPages = pages;
        let filteredLinks = links;

        // FILTERING LOGIC: If a persona is active, filter pages and links
        if (activePersona && activePersona.pages) {
            // Normalize persona pages for matching (loose matching)
            const personaPageSet = new Set(activePersona.pages.map(p => {
                try { return new URL(p, 'http://dummy.com').pathname; } catch (e) { return p; }
            }));

            filteredPages = pages.filter(p => {
                try {
                    const u = new URL(p.url).pathname;
                    // Check if exact match or if persona listing logic included full url
                    return personaPageSet.has(u) || activePersona.pages.includes(p.url);
                } catch (e) { return false; }
            });

            const validNodeIds = new Set(filteredPages.map(p => p.url));
            filteredLinks = links.filter(l => validNodeIds.has(l.source) && validNodeIds.has(l.target));
        }

        const initialNodes = filteredPages.map((page) => {
            let label = '/';
            try {
                const u = new URL(page.url);
                label = u.pathname === '/' ? u.hostname : u.pathname;
                if (label.length > 20) label = label.slice(0, 8) + '...' + label.slice(-8);
            } catch (e) { }
            const isDoc = page.type === 'document';
            return {
                id: page.url,
                data: { label },
                position: { x: 0, y: 0 },
                style: isDoc ? {
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #7dd3fc',
                    width: 150
                } : { width: 150 }
            };
        });

        const inwardDegree = {};
        filteredLinks.forEach(l => { inwardDegree[l.target] = (inwardDegree[l.target] || 0) + 1; });
        const HUB_THRESHOLD = 4;
        const visitedHubs = new Set();
        const validNodeIds = new Set(filteredPages.map(p => p.url));
        const initialEdges = [];

        filteredLinks.forEach((link, i) => {
            if (!validNodeIds.has(link.source) || !validNodeIds.has(link.target)) return;
            if (link.source === link.target) return;
            const isHub = inwardDegree[link.target] >= HUB_THRESHOLD;
            if (isHub) {
                if (!visitedHubs.has(link.target)) {
                    visitedHubs.add(link.target);
                    initialEdges.push({ id: `e${i}`, source: link.source, target: link.target, animated: true, style: { stroke: '#cbd5e1', strokeWidth: 1 } });
                }
            } else {
                initialEdges.push({ id: `e${i}`, source: link.source, target: link.target, animated: true, style: { stroke: '#64748b', strokeWidth: 1.5 } });
            }
        });

        // Layout Logic with Direction Support
        const g = new dagre.graphlib.Graph();
        g.setGraph({
            rankdir: direction,
            nodesep: 50,
            ranksep: 80
        });
        g.setDefaultEdgeLabel(() => ({}));

        initialNodes.forEach(node => g.setNode(node.id, { width: 150, height: 50 }));
        initialEdges.forEach(edge => g.setEdge(edge.source, edge.target));

        dagre.layout(g);

        initialNodes.forEach(node => {
            const nodeWithPosition = g.node(node.id);
            node.targetPosition = direction === 'TB' ? 'top' : 'left';
            node.sourcePosition = direction === 'TB' ? 'bottom' : 'right';
            node.position = {
                x: nodeWithPosition.x - 75,
                y: nodeWithPosition.y - 25,
            };
        });

        return { nodes: initialNodes, edges: initialEdges };
    }, [pages, links, direction, activePersona]);

    const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

    const { getNodes, getEdges, fitView } = useReactFlow();

    // Re-fit view when layout changes
    React.useEffect(() => {
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        // Small delay to ensure nodes are rendered before fitting
        setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 50);
    }, [layoutedNodes, layoutedEdges, fitView, setNodes, setEdges]);

    const downloadImage = () => {
        const nodes = getNodes();
        if (nodes.length === 0) return;

        const nodesBounds = getRectOfNodes(nodes);
        const transform = [
            -nodesBounds.x + 50, // 50px padding
            -nodesBounds.y + 50,
            1,
        ];

        const flowElement = document.querySelector('.react-flow');
        if (!flowElement) return;

        // Calculate safe pixel ratio to avoid canvas crashes (limit to ~4000-5000px max dimension if possible, or 2x)
        // If graph is huge (e.g. 16000px), pixelRatio 3 = 48000px -> CRASH.
        // We want to force at least 1x.
        const maxDimension = Math.max(nodesBounds.width, nodesBounds.height);
        let pixelRatio = 2;
        if (maxDimension > 3000) pixelRatio = 1.5;
        if (maxDimension > 6000) pixelRatio = 1;

        toPng(flowElement, {
            backgroundColor: '#f8fafc',
            width: nodesBounds.width + 100,
            height: nodesBounds.height + 100,
            pixelRatio: pixelRatio,
            style: {
                width: `${nodesBounds.width + 100}px`,
                height: `${nodesBounds.height + 100}px`,
                transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
            },
        }).then((dataUrl) => {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'user-flow.png';
            a.click();
        });
    };

    // Use Browser Print for True Vector PDF
    const printPdf = () => {
        const nodes = getNodes();
        if (nodes.length === 0) return;

        const nodesBounds = getRectOfNodes(nodes);

        // 1. Create a Style Tag to force the print layout to match the graph size exactly
        const style = document.createElement('style');
        style.setAttribute('id', 'print-overrides');
        style.innerHTML = `
            @media print {
                @page { size: auto; margin: 0mm; } /* Let content define size */
                
                body, html, #root { 
                    width: 100%; height: 100%; overflow: visible; 
                }

                /* Hide everything except the graph */
                body > *:not(#root) { display: none; }
                nav, aside, button, .controls { display: none !important; }

                /* Force Graph Container to Full Size */
                .react-flow {
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: ${nodesBounds.width + 100}px !important;
                    height: ${nodesBounds.height + 100}px !important;
                    z-index: 9999 !important;
                    background: white !important;
                }

                /* Force Viewport to show all nodes starting at 0,0 */
                .react-flow__viewport {
                    transform: translate(${-nodesBounds.x + 50}px, ${-nodesBounds.y + 50}px) scale(1) !important;
                }
            }
        `;
        document.head.appendChild(style);

        // 2. Print
        window.print();

        // 3. Cleanup
        document.head.removeChild(style);
    };

    const exportToFigma = () => {
        const nodes = getNodes();
        const edges = getEdges();

        if (nodes.length === 0) return;

        const nodesBounds = getRectOfNodes(nodes);
        const padding = 50;
        const width = nodesBounds.width + padding * 2;
        const height = nodesBounds.height + padding * 2;
        const xOffset = -nodesBounds.x + padding;
        const yOffset = -nodesBounds.y + padding;

        let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
        text { font-family: sans-serif; font-size: 12px; }
    </style>`;

        // Draw Edges
        edges.forEach(edge => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);

            if (source && target) {
                const srcX = source.position.x + xOffset;
                const srcY = source.position.y + yOffset;
                const tgtX = target.position.x + xOffset;
                const tgtY = target.position.y + yOffset;

                // Assuming standard dimensions 150x50 as per layout
                const nodeW = 150;
                const nodeH = 50;

                const sourcePos = direction === 'TB' ? Position.Bottom : Position.Right;
                const targetPos = direction === 'TB' ? Position.Top : Position.Left;

                const sourceX = direction === 'TB' ? srcX + nodeW / 2 : srcX + nodeW;
                const sourceY = direction === 'TB' ? srcY + nodeH : srcY + nodeH / 2;
                const targetX = direction === 'TB' ? tgtX + nodeW / 2 : tgtX;
                const targetY = direction === 'TB' ? tgtY : tgtY + nodeH / 2;

                const [pathString] = getBezierPath({
                    sourceX,
                    sourceY,
                    sourcePosition: sourcePos,
                    targetX,
                    targetY,
                    targetPosition: targetPos,
                });

                const stroke = edge.style?.stroke || '#b1b1b7';
                const strokeWidth = edge.style?.strokeWidth || 1;

                svgContent += `<path d="${pathString}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" />`;
            }
        });

        // Draw Nodes
        nodes.forEach(node => {
            const x = node.position.x + xOffset;
            const y = node.position.y + yOffset;
            const w = 150;
            const h = 50;

            // Determine styles
            const isDoc = node.style && node.style.background === '#e0f2fe'; // Simple heuristic based on current logic
            const fill = isDoc ? '#e0f2fe' : '#ffffff';
            const stroke = isDoc ? '#7dd3fc' : '#94a3b8'; // approximated from border: 1px solid col
            const textColor = isDoc ? '#0369a1' : '#1e293b'; // approximated default

            svgContent += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1" />`;

            // Label
            // Escape XML entities ?? Simple helper might be needed if labels have special chars.
            const safeLabel = (node.data.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            svgContent += `<text x="${x + w / 2}" y="${y + h / 2}" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${safeLabel}</text>`;
        });

        svgContent += '</svg>';

        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'user-flow-figma.svg';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{ width: '100%', height: '600px', border: '1px solid #eee', borderRadius: '12px', background: '#f8fafc', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setDirection(d => d === 'TB' ? 'LR' : 'TB')} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#fff', border: '1px solid #ddd' }}>
                    Layout: {direction === 'TB' ? 'Vertical' : 'Horizontal'}
                </button>
                <button onClick={downloadImage} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#fff', border: '1px solid #ddd' }}>
                    Export PNG
                </button>
                <button onClick={printPdf} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#fff', border: '1px solid #ddd' }}>
                    Export PDF (Vector)
                </button>
                <button onClick={exportToFigma} className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#fff', border: '1px solid #ddd' }}>
                    Export for Figma
                </button>
            </div>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => window.open(node.id, '_blank')}
                fitView
                className="print-graph"
            >
                <Controls />
                <Background color="#aaa" gap={16} />
            </ReactFlow>
        </div>
    );
};

const UserFlowGraphWrapper = (props) => (
    <ReactFlowProvider>
        <UserFlowGraph {...props} />
    </ReactFlowProvider>
);

export default UserFlowGraphWrapper;
