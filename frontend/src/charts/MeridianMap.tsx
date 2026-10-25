import React from 'react';
import type { EventItem, Hypothesis } from '../types';
import { Map, Radio, Hospital as HospitalIcon, AlertTriangle } from 'lucide-react';

interface MeridianMapProps {
  currentEvents: EventItem[];
  outages: Record<string, number>;
  epicenterDistrict?: string;
  topHypothesis?: Hypothesis;
  height?: number;
}

export const MeridianMap: React.FC<MeridianMapProps> = ({
  currentEvents,
  outages,
  epicenterDistrict = 'D2',
  topHypothesis = 'CASCADE',
  height = 280,
}) => {
  const width = 500;

  // District polygon definitions (schematic geometry)
  const districts = [
    { id: 'D1', name: 'D1 · North Works', path: 'M 40,30 L 180,30 L 170,110 L 30,100 Z', cx: 105, cy: 70, gw: 'GW-A' },
    { id: 'D2', name: 'D2 · Civic Core', path: 'M 180,30 L 340,30 L 330,120 L 170,110 Z', cx: 255, cy: 75, gw: 'GW-A' },
    { id: 'D3', name: 'D3 · River Quay', path: 'M 340,30 L 470,40 L 460,140 L 330,120 Z', cx: 400, cy: 85, gw: 'GW-B' },
    { id: 'D4', name: 'D4 · Old Quarter', path: 'M 170,110 L 330,120 L 310,210 L 150,190 Z', cx: 240, cy: 160, gw: 'GW-C' },
    { id: 'D5', name: 'D5 · Harbor & Rail', path: 'M 30,100 L 170,110 L 150,190 L 30,180 Z', cx: 95, cy: 145, gw: 'GW-C' },
    { id: 'D6', name: 'D6 · East Hills', path: 'M 330,120 L 460,140 L 450,220 L 310,210 Z', cx: 385, cy: 175, gw: 'GW-D' },
  ];

  // Hospitals
  const hospitals = [
    { id: 'H1', name: 'H1 General', x: 280, y: 85 },
    { id: 'H2', name: 'H2 Memorial', x: 420, y: 100 },
    { id: 'H3', name: 'H3 Civic', x: 100, y: 160 },
  ];

  // Gateways
  const gateways = [
    { id: 'GW-A', label: 'GW-A (North)', x: 190, y: 20 },
    { id: 'GW-B', label: 'GW-B (East)', x: 450, y: 25 },
    { id: 'GW-C', label: 'GW-C (South)', x: 140, y: 205 },
    { id: 'GW-D', label: 'GW-D (Hills)', x: 430, y: 230 },
  ];

  return (
    <div className="w-full bg-surface border border-rule p-2.5 select-none flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-1 text-[10px] font-mono tracking-wider text-ink-3 pb-1 border-b border-rule/50">
          <span className="font-bold text-ink">SCHEMATIC MUNICIPAL SECTORS</span>
          <span className="text-ink font-semibold">EPICENTER: SECTOR {epicenterDistrict}</span>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <defs>
            {/* Hatched pattern for gateway blackout */}
            <pattern
              id="outage-hatch"
              width="8"
              height="8"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="8" stroke="#D9421C" strokeWidth="2" strokeOpacity="0.35" />
            </pattern>
          </defs>

          {/* River outline across city */}
          <path
            d="M 335,20 C 330,80 325,140 315,240"
            fill="none"
            stroke="#1F6F8B"
            strokeWidth="6"
            strokeOpacity="0.25"
          />

          {/* Districts */}
          {districts.map((d) => {
            const isEpicenter = d.id === epicenterDistrict;
            const isGwDown = outages[d.gw] > 0.5;

            return (
              <g key={d.id}>
                <path
                  d={d.path}
                  fill={isGwDown ? 'url(#outage-hatch)' : isEpicenter ? '#F3EFE6' : '#FBF9F4'}
                  stroke="#1D1B16"
                  strokeWidth={isEpicenter ? 2 : 1}
                  strokeDasharray={isEpicenter ? '4 2' : undefined}
                />
                <text
                  x={d.cx}
                  y={d.cy}
                  textAnchor="middle"
                  className="text-[9px] font-mono fill-ink font-semibold tracking-wider pointer-events-none"
                >
                  {d.name}
                </text>
              </g>
            );
          })}

          {/* Epicenter Rubber-Stamp Ring */}
          {epicenterDistrict && (
            <g>
              {districts
                .filter((d) => d.id === epicenterDistrict)
                .map((d) => (
                  <g key={`epi-${d.id}`} transform={`translate(${d.cx}, ${d.cy})`}>
                    <circle
                      r={26}
                      fill="none"
                      stroke={topHypothesis === 'CASCADE' ? '#D9421C' : '#1F6F8B'}
                      strokeWidth={1.8}
                      strokeDasharray="4 3"
                    />
                    <text
                      y={-30}
                      textAnchor="middle"
                      className="text-[8px] font-mono fill-ink font-bold tracking-widest uppercase"
                    >
                      [EPICENTER EST.]
                    </text>
                  </g>
                ))}
            </g>
          )}

          {/* Gateways */}
          {gateways.map((gw) => {
            const isDown = outages[gw.id] > 0.5;
            return (
              <g key={gw.id} transform={`translate(${gw.x}, ${gw.y})`}>
                <rect
                  x={-5}
                  y={-5}
                  width={10}
                  height={10}
                  fill={isDown ? '#A3121F' : '#FBF9F4'}
                  stroke="#1D1B16"
                  strokeWidth={1.5}
                />
                <text
                  x={12}
                  y={3}
                  className={`text-[8px] font-mono font-medium ${
                    isDown ? 'fill-stat-bad font-bold' : 'fill-ink-2'
                  }`}
                >
                  {gw.label} {isDown ? '⚠ OFFLINE' : '✓'}
                </text>
              </g>
            );
          })}

          {/* Hospitals */}
          {hospitals.map((h) => (
            <g key={h.id} transform={`translate(${h.x}, ${h.y})`}>
              <circle r={5} fill="#FBF9F4" stroke="#1F6F8B" strokeWidth={1.5} />
              <line x1={-3} y1={0} x2={3} y2={0} stroke="#1F6F8B" strokeWidth={1.2} />
              <line x1={0} y1={-3} x2={0} y2={3} stroke="#1F6F8B" strokeWidth={1.2} />
              <text x={8} y={3} className="text-[8px] font-mono fill-ink-2 font-medium">
                {h.name}
              </text>
            </g>
          ))}

          {/* Live Event Ink Dots */}
          {currentEvents.slice(0, 16).map((ev, i) => {
            const distObj = districts.find((d) => d.id === ev.district) || districts[i % districts.length];
            const jitterX = ((i * 19) % 36) - 18;
            const jitterY = ((i * 29) % 36) - 18;
            const isCritical = ev.channel === 'hospital_arrival' || ev.channel === 'power_grid';

            return (
              <g
                key={ev.id}
                transform={`translate(${distObj.cx + jitterX}, ${distObj.cy + jitterY})`}
              >
                <circle
                  r={isCritical ? 4.5 : 3}
                  fill={isCritical ? '#D9421C' : '#4A463C'}
                  fillOpacity={0.85}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-between text-[8px] font-mono text-ink-3 pt-1.5 border-t border-rule/50 mt-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 border border-ink bg-surface inline-block" /> Gateway
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full border border-hyp-isolated bg-surface inline-block" /> Hospital
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-ink inline-block" /> Telemetry Event
        </span>
        <span className="flex items-center gap-1 text-hyp-cascade font-semibold">
          <span className="w-2 h-2 rounded-full bg-hyp-cascade inline-block" /> Critical Node
        </span>
      </div>
    </div>
  );
};
