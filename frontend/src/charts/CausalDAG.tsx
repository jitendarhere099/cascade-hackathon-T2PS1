import React from 'react';

interface CausalDAGProps {
  activeNodes: Record<string, number>;
  interventions: Record<string, boolean>;
  onToggleIntervention: (node: string) => void;
  cutEdges: string[];
  onToggleCutEdge: (edgeId: string) => void;
}

interface NodeDef {
  id: string;
  label: string;
  x: number;
  y: number;
  category: 'physical' | 'telecom' | 'health' | 'human';
}

interface EdgeDef {
  id: string;
  from: string;
  to: string;
  label: string;
}

export const CausalDAG: React.FC<CausalDAGProps> = ({
  activeNodes,
  interventions,
  onToggleIntervention,
  cutEdges,
  onToggleCutEdge,
}) => {
  const nodes: NodeDef[] = [
    { id: 'HEAVY_RAIN', label: 'Heavy Rain', x: 70, y: 50, category: 'physical' },
    { id: 'DRAINAGE_OVERLOAD', label: 'Drainage Overload', x: 220, y: 50, category: 'physical' },
    { id: 'STREET_FLOODING', label: 'Street Flooding', x: 380, y: 50, category: 'physical' },
    { id: 'TRAFFIC_COLLAPSE', label: 'Traffic Collapse', x: 530, y: 50, category: 'physical' },
    { id: 'POWER_SUBSTATION_TRIP', label: 'Power Substation Trip', x: 380, y: 150, category: 'telecom' },
    { id: 'TELECOM_DEGRADATION', label: 'Telecom Degradation', x: 530, y: 150, category: 'telecom' },
    { id: 'GATEWAY_OUTAGE', label: 'Gateway Outage', x: 670, y: 150, category: 'telecom' },
    { id: 'EMERGENCY_CALL_SURGE', label: '911 Call Surge', x: 530, y: 240, category: 'human' },
    { id: 'AMBULANCE_DELAY', label: 'Ambulance Delay', x: 670, y: 50, category: 'health' },
    { id: 'HOSPITAL_SURGE', label: 'Hospital Surge', x: 670, y: 240, category: 'health' },
  ];

  const edges: EdgeDef[] = [
    { id: 'rain-drain', from: 'HEAVY_RAIN', to: 'DRAINAGE_OVERLOAD', label: '1-3m' },
    { id: 'drain-flood', from: 'DRAINAGE_OVERLOAD', to: 'STREET_FLOODING', label: '2-4m' },
    { id: 'flood-traf', from: 'STREET_FLOODING', to: 'TRAFFIC_COLLAPSE', label: '3-5m' },
    { id: 'flood-power', from: 'STREET_FLOODING', to: 'POWER_SUBSTATION_TRIP', label: '4-7m' },
    { id: 'power-telecom', from: 'POWER_SUBSTATION_TRIP', to: 'TELECOM_DEGRADATION', label: '2-3m' },
    { id: 'telecom-gw', from: 'TELECOM_DEGRADATION', to: 'GATEWAY_OUTAGE', label: '1-2m' },
    { id: 'traf-amb', from: 'TRAFFIC_COLLAPSE', to: 'AMBULANCE_DELAY', label: '3-6m' },
    { id: 'traf-call', from: 'TRAFFIC_COLLAPSE', to: 'EMERGENCY_CALL_SURGE', label: '2-4m' },
    { id: 'amb-hosp', from: 'AMBULANCE_DELAY', to: 'HOSPITAL_SURGE', label: '2-5m' },
    { id: 'call-hosp', from: 'EMERGENCY_CALL_SURGE', to: 'HOSPITAL_SURGE', label: '3-6m' },
  ];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="w-full bg-surface border border-rule p-3 select-none">
      <div className="flex justify-between items-center mb-2 text-[11px] font-mono tracking-wider text-ink-3">
        <span>03 · DIRECTED CAUSAL GRAPH & INTERVENTION MATRIX</span>
        <span>CLICK NODE TO do() INTERVENE · CLICK EDGE TO CUT</span>
      </div>

      <svg viewBox="0 0 760 300" className="w-full h-auto">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="4"
            refX="6"
            refY="2"
            orient="auto"
          >
            <polygon points="0 0, 6 2, 0 4" fill="#4A463C" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((e) => {
          const fromNode = nodeMap.get(e.from);
          const toNode = nodeMap.get(e.to);
          if (!fromNode || !toNode) return null;

          const isCut = cutEdges.includes(e.id);
          const midX = (fromNode.x + toNode.x) / 2;
          const midY = (fromNode.y + toNode.y) / 2;

          return (
            <g key={e.id} className="cursor-pointer" onClick={() => onToggleCutEdge(e.id)}>
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke={isCut ? '#D5CEBD' : '#4A463C'}
                strokeWidth={isCut ? 1 : 1.5}
                strokeDasharray={isCut ? '3 3' : undefined}
                markerEnd={isCut ? undefined : 'url(#arrowhead)'}
              />
              <rect
                x={midX - 14}
                y={midY - 7}
                width={28}
                height={14}
                fill="#FBF9F4"
                stroke="#D5CEBD"
                strokeWidth={0.5}
              />
              <text
                x={midX}
                y={midY + 3}
                textAnchor="middle"
                className={`text-[8px] font-mono ${isCut ? 'fill-stat-bad line-through' : 'fill-ink-3'}`}
              >
                {isCut ? 'CUT' : e.label}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const isActive = activeNodes[n.id] !== undefined;
          const isForced = interventions[n.id];

          return (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              className="cursor-pointer"
              onClick={() => onToggleIntervention(n.id)}
            >
              <rect
                x={-55}
                y={-18}
                width={110}
                height={36}
                fill={isForced ? '#EAE5D8' : isActive ? '#FBF9F4' : '#F3EFE6'}
                stroke={isForced ? '#B7791F' : isActive ? '#D9421C' : '#D5CEBD'}
                strokeWidth={isActive || isForced ? 2 : 1}
              />
              <text
                x={0}
                y={-2}
                textAnchor="middle"
                className={`text-[9px] font-serif font-bold ${
                  isActive ? 'fill-hyp-cascade' : 'fill-ink'
                }`}
              >
                {n.label}
              </text>
              <text
                x={0}
                y={11}
                textAnchor="middle"
                className="text-[7px] font-mono fill-ink-3 tracking-wider uppercase"
              >
                {isForced ? '[do() FORCED]' : isActive ? '● ACTIVE' : '○ PENDING'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
