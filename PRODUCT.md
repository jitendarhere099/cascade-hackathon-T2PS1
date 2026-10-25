# Product Context: Firstlight

## Overview
**Firstlight** is the Meridian Municipal Crisis Prediction & Decision Engine. It operates as a 24/7 disaster intelligence and emergency operations console serving an urban population of 8.2 million.

## Primary Users & Roles
- **City Emergency Duty Officers**: Make real-time decisions on alert levels (`WATCH`, `PREPARE`, `ALERT`, `ESCALATE`) under high cognitive load and strict time pressure.
- **Municipal Incident Commanders**: Coordinate multi-agency response teams (fire, rescue, police, public health, transit, utilities).
- **Disaster Operations Analysts**: Review causal pathways, model calibration, evidence attribution, and sensor telemetry reliability.

## Core Problem & Mechanism
- **The Core Problem**: In cascading municipal crises (e.g., severe monsoon rain leading to drainage saturation, arterial roadway flooding, 911 dispatch saturation, hospital ambulance diversions, and power substation trips), traditional single-domain monitoring systems either alert too late (causing catastrophic damage) or issue repeated false alarms (inducing operator alert fatigue and public desensitization).
- **The Core Mechanism**:
  1. **Bitemporal Vectorised Particle Filter**: Runs an overdispersed Negative Binomial state filter ($N=4000$ particles) over 4 mutually exclusive, exhaustive hypotheses (`NOISE`, `SENSOR_FAILURE`, `ISOLATED_INCIDENT`, `CASCADING_CRISIS`).
  2. **Bitemporal Rollback Re-Filtering**: Handles delayed out-of-order packets, duplicates, and sensor retractions via rolling 20-minute state checkpoints without corrupting posterior probabilities.
  3. **Causal Foresight**: Uses a structural DAG to predict the next 3 downstream crisis events with time windows and information-gain observations.
  4. **Decision Geometry & Optimal Stopping**: Evaluates an asymmetric municipal loss function $L(\text{action}, \text{hypothesis}, \text{delay}, \text{fatigue})$, enforcing minimum dwell locks (hysteresis) to eliminate alert flickering.

## Operating Mode & User Experience
- **Mode**: `Operate`
- **Context of Use**: High-stress municipal emergency operations center (EOC) and mobile field duty terminals.
- **Key UX Requirements**: Extreme scanability, unambiguous typography, high contrast, non-generic control room aesthetic, full color-blind safety via distinct glyphs, patterns, and direct labels.

## Platform & Devices
- **Platform**: `web`
- **Form Factors**:
  - **Broadsheet Desktop (1440px+)**: 12-column high-density operations dashboard.
  - **Tablet (768px–1024px)**: Responsive multi-column reflow.
  - **Mobile (<768px)**: "One-Button" Field Terminal with single-tap directive confirmation.

## Stack & Architecture
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, D3.js, Lucide React, Fontsource (Newsreader, Instrument Sans, IBM Plex Mono).
- **Backend / Engine**: FastAPI (Python) with WebSocket telemetry stream, paired with an isomorphic in-browser TypeScript particle simulation engine for zero-error standalone operation and Vercel parity.

