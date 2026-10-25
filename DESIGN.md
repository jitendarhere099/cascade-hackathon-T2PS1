---
name: Firstlight Design System
description: Municipal Emergency Operations & Crisis Prediction Broadsheet
colors:
  paper: "#F3EFE6"
  paper-2: "#EAE5D8"
  surface: "#FBF9F4"
  ink: "#1D1B16"
  ink-2: "#4A463C"
  ink-3: "#7B7566"
  rule: "#D5CEBD"
  hyp-noise: "#8A8574"
  hyp-sensor: "#B7791F"
  hyp-isolated: "#1F6F8B"
  hyp-cascade: "#D9421C"
  act-watch: "#4A463C"
  act-prepare: "#B7791F"
  act-alert: "#D9631C"
  act-escalate: "#A3121F"
  stat-ok: "#3F7D58"
  stat-warn: "#B7791F"
  stat-bad: "#A3121F"
typography:
  display:
    fontFamily: '"Newsreader", Georgia, serif'
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  heading:
    fontFamily: '"Instrument Sans", -apple-system, BlinkMacSystemFont, sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: '"Instrument Sans", -apple-system, BlinkMacSystemFont, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  mono:
    fontFamily: '"IBM Plex Mono", Menlo, monospace'
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.04em"
rounded:
  sm: "2px"
  md: "2px"
  lg: "2px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
---

## Overview
The Firstlight design system is an authentic, high-reliability municipal crisis operations broadsheet. Designed for urban emergency duty officers, it combines the authority of official government disaster publications with the real-time telemetry density of scientific monitoring rooms.

It intentionally rejects the ubiquitous dark-mode SaaS aesthetic (purple neon glows, floating cards, decorative gradients) in favor of tactile physical materiality: warm archival paper, carbon ink, 1px hairlines, and Newsreader lining figures.

## Colors
- **Warm Paper Canvas (`#F3EFE6`)**: Primary environment background, evoking printed broadsheet bulletins.
- **Recessed Paper (`#EAE5D8`)**: Subordinate containers, timeline tracks, and subtle structural frames.
- **Surface Ivory (`#FBF9F4`)**: High-contrast content panels, chart backdrops, and active cards.
- **Deep Carbon Ink (`#1D1B16`)**: Primary typographic color for maximum optical contrast (≥10:1 ratio on surface).
- **Secondary Ink (`#4A463C`) & Tertiary Ink (`#7B7566`)**: Metadata, descriptive labels, and timeline guides.
- **Structural Hairline Rule (`#D5CEBD`)**: 1px crisp borders separating functional zones.
- **Hypothesis Palette**:
  - `NOISE`: Neutral grey `#8A8574`
  - `SENSOR FAILURE`: Amber `#B7791F`
  - `ISOLATED INCIDENT`: Slate blue `#1F6F8B`
  - `CASCADING CRISIS`: Red-orange `#D9421C`
- **Graduated Action Ladder**:
  - `WATCH`: Low-cost passive monitoring (`#4A463C`)
  - `PREPARE`: Standby alert and resource staging (`#B7791F`)
  - `ALERT`: Public notifications and traffic diversions (`#D9631C`)
  - `ESCALATE`: Multi-agency emergency mobilization (`#A3121F`)

## Typography
- **Newsreader Serif**: Used for top masthead numerals, prominent probability percentages, incident titles, and official narrative logs. Brings institutional weight and rapid legibility.
- **Instrument Sans**: Primary UI sans-serif for button labels, descriptions, and structural headers. Highly readable at small text sizes.
- **IBM Plex Mono**: Strictly reserved for numerical telemetry, simulation clocks (`T+00:00`), sensor source IDs, loss units, and coordinates. Styled with `.tnum` (tabular-nums lining-nums) to prevent digit jittering during live streams.

## Layout
- **12-Column Responsive Grid**:
  - **Left Rail (3 Cols)**: 04 Bitemporal Event Ledger with hardware status register.
  - **Center Core (6 Cols)**: 01 Calibrated Probability Cards, 01 Belief Streamgraph River, 02 Recommended Action Directive, 02 Decision Geometry.
  - **Right Rail (3 Cols)**: 03 Causal Foresight range bars and 06 Meridian Cartography.
  - **Bottom Banner (12 Cols)**: 05 Evidence Attribution Waterfall and Mind-Change Audit Report.
- **Responsive Adaptations**:
  - Tablet (768px–1024px): 2-column stacked flow.
  - Mobile (<768px): Dedicated One-Button Duty Officer Terminal.

## Elevation & Depth
- **Zero Heavy Drop Shadows**: Avoids blurred floating shadows. Depth is communicated strictly through surface layering (`paper` → `paper-2` → `surface`) and crisp 1px rule boundaries.
- **Subtle Hard Borders**: 1px hairline rules (`#D5CEBD`) maintain clean demarcation without visual noise.

## Shapes
- **Minimal Radius (2px)**: Crisp architectural corners echoing technical instruments and archival printing, rather than oversized playful pills.

## Components
- **Action Directive Banner**: High-contrast command block with active response color, matching action icon, and system directive typography.
- **Streamgraph Belief River**: Custom D3.js area chart with percentage Y-axis ticks, Twin Split boundary line, and active cursor beacon.
- **Decision Geometry**: Real-time expected loss curves with dynamic minimum-loss marker and live-editable cost model.
- **Causal Range Bars**: Time-window projections with wrapped causal node sequences and separated plain-language rationales.

## Do's and Don'ts
- **DO** use tabular figures (`.tnum`) for all time-series and counter numbers.
- **DO** maintain 1px clean borders; avoid thick colored left/right borders.
- **DO** use real Lucide icons with consistent stroke and size.
- **DO** preserve color-blind safety by pairing colors with text labels and glyphs.
- **DON'T** use generic AI SaaS dark-mode templates, neon purple glows, or floating cards.
- **DON'T** use emojis as interface icons.
- **DON'T** use 0.01ms animation kills for `prefers-reduced-motion`; use instant clean transitions.
- **DON'T** truncate critical causal paths; wrap node sequences cleanly.

