"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import ReactFlow, {
    Background,
    Controls,
    Node,
    Edge,
    useNodesState,
    useEdgesState,
    useReactFlow,
    ReactFlowProvider,
    getRectOfNodes,
    getTransformForBounds,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import CrowNode from "./CrowNode";
import { toPng } from 'html-to-image';

const nodeTypes = {
    crow: CrowNode,
};

interface CrowDiagramProps {
    schema: any;
    graph: any;
}

type LayoutMode = "LR" | "TB" | "BT" | "RL";

function runDagreLayout(nodes: Node[], edges: Edge[], rankdir: LayoutMode, nodesep: number, ranksep: number) {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir, nodesep, ranksep });
    g.setDefaultEdgeLabel(() => ({}));
    nodes.forEach(n => g.setNode(n.id, { width: 280, height: 220 }));
    edges.forEach(e => g.setEdge(e.source, e.target));
    dagre.layout(g);
    return nodes.map(node => {
        const p = g.node(node.id);
        return { ...node, position: { x: p.x, y: p.y } };
    });
}

function CrowDiagramContent({ schema, graph }: CrowDiagramProps) {
    const { fitView } = useReactFlow();
    const [layoutMode, setLayoutMode] = useState<LayoutMode>("LR");
    const [currentNs, setCurrentNs] = useState(140);

    const { initialNodes, initialEdges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];
        const tables = Object.keys(schema || {});

        tables.forEach(table => {
            nodes.push({
                id: table,
                type: "crow",
                data: { label: table, columns: schema[table] },
                position: { x: 0, y: 0 },
            });
        });

        const addedEdges = new Set<string>();
        Object.keys(graph || {}).forEach(from => {
            (graph[from] || []).forEach((rel: any) => {
                const target = typeof rel === "string" ? rel : rel?.to;
                if (!tables.includes(target)) return;
                const edgeKey = [from, target].sort().join("-");
                if (addedEdges.has(edgeKey)) return;
                addedEdges.add(edgeKey);

                const relType = typeof rel === "object" && rel?.type ? rel.type : "1:N";
                const [cardFrom, cardTo] = relType.split(":");

                const relationName = `${from}_${target}`;

                edges.push({
                    id: `e-${from}-${target}`,
                    source: from,
                    target: target,
                    type: "smoothstep",
                    label: `${relationName}\n${cardFrom}:${cardTo}`,
                    labelStyle: { fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" },
                    labelBgStyle: { fill: "#0f172a", fillOpacity: 0.9 },
                    style: { stroke: "#D97706", strokeWidth: 1.5 },
                    animated: false,
                    markerEnd: "url(#crow-many)",
                });
            });
        });

        const positioned = runDagreLayout(nodes, edges, layoutMode, currentNs, 240);
        return { initialNodes: positioned, initialEdges: edges };
    }, [schema, graph, layoutMode, currentNs]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
        setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
    }, [schema, graph, layoutMode, currentNs, fitView, setNodes, setEdges, initialNodes, initialEdges]);

    const applyLayout = (mode: LayoutMode, ns: number) => {
        setLayoutMode(mode);
        setCurrentNs(ns);
        const reposNodes = runDagreLayout(nodes, edges, mode, ns, 240);
        setNodes(reposNodes);
        setTimeout(() => fitView({ padding: 0.2, duration: 600 }), 50);
    };

    const layoutButtons: { label: string; mode: LayoutMode; ns: number }[] = [
        { label: "→ Left-Right", mode: "LR", ns: 140 },
        { label: "↓ Top-Down",   mode: "TB", ns: 140 },
        { label: "✦ Snowflake",  mode: "LR", ns: 50  },
        { label: "← Reverse",    mode: "RL", ns: 140 },
    ];

    const downloadImage = useCallback(() => {
        const nodesBounds = getRectOfNodes(nodes);
        const transform = getTransformForBounds(nodesBounds, 1920, 1080, 0.5, 2);

        const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!viewport) return;

        toPng(viewport, {
            backgroundColor: '#0a0f1e',
            width: 1920,
            height: 1080,
            style: {
                width: '1920px',
                height: '1080px',
                transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
            },
        }).then((dataUrl) => {
            const a = document.createElement('a');
            a.setAttribute('download', 'crow-foot-diagram.png');
            a.setAttribute('href', dataUrl);
            a.click();
        });
    }, [nodes]);

    return (
        <div className="w-full h-full bg-[#0a0f1e] relative">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2">
                {layoutButtons.map(({ label, mode, ns }) => (
                    <button
                        key={label}
                        onClick={() => applyLayout(mode, ns)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${layoutMode === mode && currentNs === ns ? "bg-orange-500/20 text-orange-300 border border-orange-500/40" : "text-slate-400 hover:text-orange-300 hover:bg-white/5"}`}
                    >
                        {label}
                    </button>
                ))}
                
                <button
                    onClick={downloadImage}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all text-slate-400 hover:text-green-300 hover:bg-white/5 flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export PNG
                </button>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodesDraggable={true}
                panOnDrag={true}
                minZoom={0.05}
                maxZoom={2}
                className="bg-transparent"
            >
                <Background color="#1e293b" gap={20} />
                <Controls />
            </ReactFlow>
        </div>
    );
}

export default function CrowDiagram(props: CrowDiagramProps) {
    return (
        <ReactFlowProvider>
            <CrowDiagramContent {...props} />
        </ReactFlowProvider>
    );
}
