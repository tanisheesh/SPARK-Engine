"use client";

import React, { useMemo, useCallback, useState } from "react";
import ReactFlow, { 
    Background, 
    Controls, 
    Node, 
    Edge,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    useReactFlow,
    getRectOfNodes,
    getTransformForBounds,
    ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { toPng } from 'html-to-image';

import EntityNode from "./EntityNode";
import AttributeNode from "./AttributeNode";
import RelationshipNode from "./RelationshipNode";
import ISANode from "./ISANode";
import WaypointEdge from "./WaypointEdge";

const nodeTypes = {
  entity: EntityNode,
  attribute: AttributeNode,
  relationship: RelationshipNode,
  isa: ISANode,
};

const edgeTypes = {
  waypoint: WaypointEdge,
};

export default function ChenDiagram(props: any) {
    return (
        <ReactFlowProvider>
            <ChenDiagramContent {...props} />
        </ReactFlowProvider>
    );
}

function ChenDiagramContent({ schema, graph }: any) {
    const { getNodes } = useReactFlow();
    
    const { initialNodes, initialEdges } = useMemo(() => {
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        const tables = Object.keys(schema || {});
        if (tables.length === 0) return { initialNodes: [], initialEdges: [] };

        // -----------------------
        // HELPERS
        // -----------------------
        const isPK = (table: string, col: string) =>
            col === "id" || col === `${table.toLowerCase()}_id` || col === `${table}_id`;

        const isFK = (col: string) =>
            col.endsWith("_id") && !col.startsWith("id");

        const isMulti = (col: string) =>
            col.includes("tags") || col.includes("skills") || col.includes("list");

        const isDerived = (col: string) =>
            col.includes("age") || col.includes("total") || col.includes("count");
            
        // A true weak entity completely lacks its own primary key
        const isWeakTable = (t: string) => !schema[t]?.some((c: string) => isPK(t, c));

        // Intelligent relationship verb generator
        const VERB_MAP: Record<string, string> = {
            "create": "Creates", "write": "Writes", "author": "Authors",
            "own": "Owns", "manage": "Manages", "assign": "Assigns",
            "contain": "Contains", "include": "Includes", "comprise": "Comprises",
            "belong": "Belongs To", "join": "Joins", "enroll": "Enrolls In",
            "member": "Member Of", "attend": "Attends", "subscribe": "Subscribes",
            "buy": "Buys", "purchase": "Purchases", "sell": "Sells",
            "pay": "Pays For", "order": "Orders", "book": "Books",
            "send": "Sends", "receive": "Receives", "post": "Posts",
            "comment": "Comments On", "reply": "Replies To", "review": "Reviews",
            "like": "Likes", "follow": "Follows", "share": "Shares",
            "report": "Reports To", "supervise": "Supervises", "parent": "Parent Of",
            "child": "Child Of", "teach": "Teaches", "employ": "Employs",
            "locate": "Located In", "categorize": "Categorized By",
            "tag": "Tagged With", "rate": "Rates",
        };

        const getVerb = (from: string, to: string) => {
            const fl = from.toLowerCase();
            const tl = to.toLowerCase();

            const fromCols = (schema[from] || []).map((c: string) => c.toLowerCase());
            const toCols = (schema[to] || []).map((c: string) => c.toLowerCase());

            for (const [keyword, verb] of Object.entries(VERB_MAP)) {
                if (fl.includes(keyword) || tl.includes(keyword)) return verb;
            }

            const fromHasFKtoTo = fromCols.some((c: string) =>
                c === `${tl}_id` || c === `${tl.replace(/s$/, "")}_id`
            );
            const toHasFKtoFrom = toCols.some((c: string) =>
                c === `${fl}_id` || c === `${fl.replace(/s$/, "")}_id`
            );

            if (fromHasFKtoTo && !toHasFKtoFrom) return "Belongs To";
            if (toHasFKtoFrom && !fromHasFKtoTo) return "Has";
            if (fromHasFKtoTo && toHasFKtoFrom) return "Links";

            if (tl === fl + "s" || tl === fl + "es") return "Has";
            if (fl === tl + "s" || fl === tl + "es") return "Belongs To";

            return `${from}_${to}`;
        };

        // -----------------------
        // CONCENTRIC DEGREE ALGORITHM
        // -----------------------
        const degrees: Record<string, number> = {};
        tables.forEach(t => degrees[t] = 0);
        Object.keys(graph || {}).forEach(from => {
            graph[from]?.forEach((rel: any) => {
                const to = typeof rel === "string" ? rel : rel?.to;
                if (to && schema[to]) {
                    degrees[from] = (degrees[from] || 0) + 1;
                    degrees[to] = (degrees[to] || 0) + 1;
                }
            });
        });

        const sortedTables = [...tables].sort((a, b) => degrees[b] - degrees[a]);
        const tablePositions: Record<string, {x: number, y: number}> = {};

        sortedTables.forEach((table, i) => {
            if (i === 0) {
                tablePositions[table] = { x: 0, y: 0 };
            } else {
                let ring = 1;
                let itemsBefore = 1;
                let itemsInCurrentRing = 6;
                while (i >= itemsBefore + itemsInCurrentRing) {
                    itemsBefore += itemsInCurrentRing;
                    ring++;
                    itemsInCurrentRing = ring * 6;
                }
                const indexInRing = i - itemsBefore;
                const angle = (indexInRing / itemsInCurrentRing) * Math.PI * 2;
                const radius = ring * 800;
                
                tablePositions[table] = {
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius
                };
            }
        });

        // -----------------------
        // ENTITIES + ATTRIBUTES
        // -----------------------
        tables.forEach((table) => {
            const entityId = `entity-${table}`;
            const { x: baseX, y: baseY } = tablePositions[table];

            newNodes.push({
                id: entityId,
                type: "entity",
                data: { label: table, isWeak: isWeakTable(table) },
                position: { x: baseX, y: baseY },
            });

            const attrs = schema[table];
            const radius = 180;

            attrs.forEach((col: string, j: number) => {
                const angle = (j / attrs.length) * 2 * Math.PI;
                const x = baseX + radius * Math.cos(angle);
                const y = baseY + radius * Math.sin(angle);
                const attrId = `attr-${table}-${col}`;

                newNodes.push({
                    id: attrId,
                    type: "attribute",
                    data: { 
                        label: col, 
                        isPK: isPK(table, col),
                        isMulti: isMulti(col),
                        isDerived: isDerived(col)
                    },
                    position: { x, y },
                });

                newEdges.push({
                    id: `edge-${entityId}-${attrId}`,
                    source: entityId,
                    target: attrId,
                    type: "waypoint",
                    style: { stroke: "#64748b", strokeWidth: 1 }
                });
            });
        });

        // -----------------------
        // RELATIONSHIPS
        // -----------------------
        Object.keys(graph || {}).forEach((from, i) => {
            graph[from]?.forEach((rel: any, j: number) => {
                const to = typeof rel === "string" ? rel : rel?.to;
                if (!to || !schema[to]) return;

                const relId = `rel-${from}-${to}-${j}`;
                
                const fromP = tablePositions[from];
                const toP = tablePositions[to];

                const x = (fromP.x + toP.x) / 2 + 50;
                const y = (fromP.y + toP.y) / 2 + 50;

                const isIdentifying = isWeakTable(from) || isWeakTable(to);
                const relType = typeof rel === "string" ? "1:N" : (rel?.type || "1:N");
                const [cardFrom, cardTo] = relType.split(":");

                newNodes.push({
                    id: relId,
                    type: "relationship",
                    data: { label: getVerb(from, to), isIdentifying },
                    position: { x, y },
                });

                newEdges.push({
                    id: `e-${from}-${relId}`,
                    source: `entity-${from}`,
                    target: relId,
                    type: "waypoint",
                    label: cardFrom !== "undefined" ? cardFrom : "",
                    labelStyle: { fill: "#facc15", fontWeight: "900", fontSize: 14 },
                    style: { stroke: "#facc15", strokeWidth: 2 }
                });

                newEdges.push({
                    id: `e-${relId}-${to}`,
                    source: relId,
                    target: `entity-${to}`,
                    type: "waypoint",
                    label: cardTo !== "undefined" ? cardTo : "",
                    labelStyle: { fill: "#facc15", fontWeight: "900", fontSize: 14 },
                    style: { stroke: "#facc15", strokeWidth: 2 }
                });
            });
        });

        return { initialNodes: newNodes, initialEdges: newEdges };
    }, [schema, graph]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [editMode, setEditMode] = useState(false);

    const onConnect = useCallback(
        (params: Connection) =>
            setEdges(eds => addEdge({ ...params, type: "waypoint", style: { stroke: "#facc15", strokeWidth: 2 }, deletable: true }, eds)),
        [setEdges]
    );

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
            a.setAttribute('download', 'chen-diagram.png');
            a.setAttribute('href', dataUrl);
            a.click();
        });
    }, [nodes]);

    return (
        <div className="w-full h-full bg-[#0a0f1e] relative">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2">
                <button
                    onClick={() => setEditMode(m => !m)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${editMode ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" : "text-slate-400 hover:text-yellow-300 hover:bg-white/5"}`}
                >
                    {editMode ? "✏️ Editing On" : "✏️ Edit Mode"}
                </button>
                {editMode && (
                    <span className="text-[10px] text-slate-500 self-center">Drag handle → handle to connect · Select edge + Delete to remove</span>
                )}
                
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
                edges={edges.map(e => ({
                    ...e,
                    deletable: editMode,
                    selectable: editMode,
                    interactionWidth: editMode ? 20 : 0,
                    focusable: editMode,
                    style: {
                        ...e.style,
                        ...(editMode ? { cursor: "pointer", strokeWidth: 3 } : {}),
                    },
                }))}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={editMode ? onConnect : undefined}
                nodesDraggable={true}
                panOnDrag
                elementsSelectable={editMode}
                selectNodesOnDrag={false}
                deleteKeyCode={["Backspace", "Delete"]}
                connectOnClick={false}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.05}
                maxZoom={1}
                className="bg-transparent"
            >
                <Background color="#1e293b" gap={20} />
                <Controls />
            </ReactFlow>
        </div>
    );
}
