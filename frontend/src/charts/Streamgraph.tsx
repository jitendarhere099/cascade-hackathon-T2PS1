import React, { useMemo } from 'react';
import * as d3 from 'd3';
import type { BeliefUpdate, Hypothesis } from '../types';
import { HelpCircle, Clock, Split, Info } from 'lucide-react';

interface StreamgraphProps {
  history: BeliefUpdate[];
  currentT: number;
  onSeek?: (t: number) => void;
  height?: number;
}

const HYP_COLORS: Record<Hypothesis, string> = {
  NOISE: '#8A8574',
  SENSOR_FAILURE: '#B7791F',
  ISOLATED: '#1F6F8B',
  CASCADE: '#D9421C',
};

const HYP_LABELS: Record<Hypothesis, { title: string; short: string; glyph: string }> = {
  NOISE: { title: '01 · NOISE', short: 'Noise', glyph: '·' },
  SENSOR_FAILURE: { title: '02 · SENSOR FAIL', short: 'Sensor Fail', glyph: '⊘' },
  ISOLATED: { title: '03 · ISOLATED', short: 'Isolated', glyph: '△' },
  CASCADE: { title: '04 · CASCADE', short: 'Cascade', glyph: '▲' },
};

export const Streamgraph: React.FC<StreamgraphProps> = ({
  history,
  currentT,
  onSeek,
  height = 240,
}) => {
  const width = 640;
  const margin = { top: 28, right: 94, bottom: 28, left: 42 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Generate data points from 0 to 15
  const chartData = useMemo(() => {
    const points: Array<{
      t: number;
      NOISE: number;
      SENSOR_FAILURE: number;
      ISOLATED: number;
      CASCADE: number;
      mindChanged: boolean;
      mindMsg?: string;
    }> = [];

    for (let m = 0; m <= 15; m++) {
      const match = history.find((h) => h.t === m);
      if (match) {
        points.push({
          t: m,
          NOISE: match.probs.NOISE,
          SENSOR_FAILURE: match.probs.SENSOR_FAILURE,
          ISOLATED: match.probs.ISOLATED,
          CASCADE: match.probs.CASCADE,
          mindChanged: match.mind_change.changed,
          mindMsg: match.mind_change.message,
        });
      } else if (points.length > 0) {
        // Project forward with last known
        const prev = points[points.length - 1];
        points.push({
          t: m,
          NOISE: prev.NOISE,
          SENSOR_FAILURE: prev.SENSOR_FAILURE,
          ISOLATED: prev.ISOLATED,
          CASCADE: prev.CASCADE,
          mindChanged: false,
        });
      } else {
        points.push({
          t: m,
          NOISE: 0.7,
          SENSOR_FAILURE: 0.15,
          ISOLATED: 0.1,
          CASCADE: 0.05,
          mindChanged: false,
        });
      }
    }
    return points;
  }, [history]);

  const xScale = useMemo(() => {
    return d3.scaleLinear().domain([0, 15]).range([0, innerWidth]);
  }, [innerWidth]);

  const yScale = useMemo(() => {
    return d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);
  }, [innerHeight]);

  // D3 Stack
  const stack = d3
    .stack<(typeof chartData)[0]>()
    .keys(['NOISE', 'SENSOR_FAILURE', 'ISOLATED', 'CASCADE'])
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const series = stack(chartData);

  const areaGenerator = d3
    .area<d3.SeriesPoint<(typeof chartData)[0]>>()
    .x((d) => xScale(d.data.t))
    .y0((d) => yScale(d[0]))
    .y1((d) => yScale(d[1]))
    .curve(d3.curveMonotoneX);

  // Latest or current point for legend probabilities
  const activePoint = chartData[Math.min(currentT, chartData.length - 1)] || chartData[0];

  return (
    <div className="w-full overflow-hidden bg-surface border border-rule p-3 select-none">
      {/* Header and Domain Indicator */}
      <div className="flex flex-wrap justify-between items-center mb-1.5 text-[11px] font-mono tracking-wider text-ink-3 pb-1 border-b border-rule/50">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-ink">01 · BELIEF TIMELINE</span>
          <span className="text-[10px] text-ink-3 hidden sm:inline">(POSTERIOR PROBABILITY RIVER)</span>
          <span
            className="cursor-help text-ink-3 hover:text-ink ml-1 inline-flex items-center"
            title="Calibrated posterior belief probability distribution across 4 mutually exclusive, exhaustive hypotheses over simulation time."
          >
            <Info className="w-3 h-3" />
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="px-1.5 py-0.2 bg-paper-2 border border-rule text-ink-2">
            DOMAIN: T+00:00 — T+00:15
          </span>
          <span className="text-ink-3 hidden md:inline">CLICK TIMELINE TO SEEK</span>
        </div>
      </div>

      {/* SVG Streamgraph */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto cursor-pointer focus:outline-none"
        role="img"
        aria-label="Belief timeline river showing posterior hypothesis probabilities over time"
        onClick={(e) => {
          if (!onSeek) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = ((e.clientX - rect.left) / rect.width) * width - margin.left;
          const targetT = Math.round(Math.max(0, Math.min(15, xScale.invert(clickX))));
          onSeek(targetT);
        }}
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Subtle horizontal grid lines & Y-Axis Percentage Labels */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((v) => (
            <g key={v}>
              <line
                x1={0}
                y1={yScale(v)}
                x2={innerWidth}
                y2={yScale(v)}
                stroke="#EAE5D8"
                strokeDasharray="2 3"
                strokeWidth={1}
              />
              <text
                x={-6}
                y={yScale(v) + 3}
                textAnchor="end"
                className="text-[8px] font-mono fill-ink-3"
              >
                {`${Math.round(v * 100)}%`}
              </text>
            </g>
          ))}

          {/* Area bands */}
          {series.map((s) => {
            const hyp = s.key as Hypothesis;
            const pathData = areaGenerator(s) || '';
            const lastPoint = s[s.length - 1];
            const labelY = yScale((lastPoint[0] + lastPoint[1]) / 2);

            return (
              <g key={hyp}>
                <path
                  d={pathData}
                  fill={HYP_COLORS[hyp]}
                  fillOpacity={0.88}
                  stroke="#F3EFE6"
                  strokeWidth={0.75}
                />
                {/* Direct inline label on right margin */}
                <text
                  x={innerWidth + 6}
                  y={labelY + 3}
                  className="text-[9px] font-mono fill-ink-2 font-medium"
                >
                  {HYP_LABELS[hyp].title}
                </text>
              </g>
            );
          })}

          {/* Twin Split rule at T=7 */}
          <line
            x1={xScale(7)}
            y1={0}
            x2={xScale(7)}
            y2={innerHeight}
            stroke="#1D1B16"
            strokeDasharray="3 3"
            strokeWidth={1.2}
          />
          {/* Twin Split Tag */}
          <g transform={`translate(${xScale(7)}, -8)`}>
            <rect
              x={-42}
              y={-10}
              width={84}
              height={14}
              fill="#F3EFE6"
              stroke="#1D1B16"
              strokeWidth={0.75}
            />
            <text
              x={0}
              y={0}
              textAnchor="middle"
              className="text-[8px] font-mono fill-ink tracking-wide font-bold"
            >
              TWIN SPLIT (T+7)
            </text>
          </g>

          {/* Current T indicator rule */}
          <line
            x1={xScale(currentT)}
            y1={0}
            x2={xScale(currentT)}
            y2={innerHeight}
            stroke="#1D1B16"
            strokeWidth={1.8}
          />
          {/* Subtle cursor glow line */}
          <line
            x1={xScale(currentT)}
            y1={0}
            x2={xScale(currentT)}
            y2={innerHeight}
            stroke="#FFFFFF"
            strokeOpacity={0.4}
            strokeWidth={0.8}
          />

          {/* Current Time Cursor Badge */}
          <g transform={`translate(${xScale(currentT)}, -8)`}>
            <rect
              x={-24}
              y={-12}
              width={48}
              height={14}
              fill="#1D1B16"
            />
            <text
              x={0}
              y={-2}
              textAnchor="middle"
              className="text-[8px] font-mono fill-paper tracking-wider font-bold"
            >
              {`T+${currentT < 10 ? '0' : ''}${currentT}:00`}
            </text>
            <polygon
              points={`-4,2 4,2 0,6`}
              fill="#1D1B16"
            />
          </g>

          {/* Mind-change event markers */}
          {chartData.map((d) => {
            if (!d.mindChanged || d.t > currentT) return null;
            return (
              <g
                key={`mc-${d.t}`}
                transform={`translate(${xScale(d.t)}, ${innerHeight})`}
              >
                <circle r={4.5} fill="#FBF9F4" stroke="#D9421C" strokeWidth={1.5} />
                <circle r={1.5} fill="#D9421C" />
                <text
                  y={14}
                  textAnchor="middle"
                  className="text-[8px] font-mono fill-hyp-cascade font-bold"
                >
                  #{d.t}
                </text>
              </g>
            );
          })}

          {/* Time axis */}
          <line
            x1={0}
            y1={innerHeight}
            x2={innerWidth}
            y2={innerHeight}
            stroke="#1D1B16"
            strokeWidth={1}
          />
          {[0, 3, 5, 7, 10, 12, 15].map((m) => (
            <g key={m} transform={`translate(${xScale(m)}, ${innerHeight})`}>
              <line y2={4} stroke="#1D1B16" strokeWidth={1} />
              <text
                y={15}
                textAnchor="middle"
                className="text-[9px] font-mono fill-ink-3 font-medium"
              >
                {`T+${m < 10 ? '0' : ''}${m}`}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Legend Linking Colors Directly to Hypotheses & Live Current P */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-rule/60 text-[10px] font-mono">
        {(['NOISE', 'SENSOR_FAILURE', 'ISOLATED', 'CASCADE'] as Hypothesis[]).map((hyp) => {
          const pVal = activePoint ? (activePoint[hyp] * 100).toFixed(0) : '0';
          return (
            <div
              key={hyp}
              className="flex items-center justify-between px-2 py-1 bg-paper/60 border border-rule/50"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2.5 h-2.5 shrink-0 inline-block border border-rule/60"
                  style={{ backgroundColor: HYP_COLORS[hyp] }}
                />
                <span className="text-ink-2 font-medium truncate">
                  {HYP_LABELS[hyp].short}
                </span>
              </div>
              <span className="font-bold text-ink tnum ml-1">{pVal}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
