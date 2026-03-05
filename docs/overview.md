# Software Development Project: F1 Session Feature Extractor

## Overview

### 1. Project Name
* **F1 Session Feature Extractor**

### 2. Project Description
* A Python library that ingests Formula 1 free practice session data from the OpenF1 API and extracts structured, meaningful KPIs per driver — designed to feed downstream AI for GridRival fantasy team selection.

### 3. Project Vision
* Compress hours of raw telemetry and timing data from FP1/FP2/FP3 into a concise feature set that an AI can reason over to recommend optimal GridRival picks. The tool should make practice session analysis effortless and data-driven.

### 4. Problem Statement
* Free practice sessions produce massive volumes of raw telemetry, timing, and stint data across 20 drivers. Manually interpreting this data to predict qualifying and race performance for fantasy team selection is time-consuming, error-prone, and inconsistent. There is no structured pipeline to reduce this data into the specific KPIs that matter for GridRival scoring.

### 5. Target Audience
* **Primary Audience:** The developer (Martin) and a downstream AI system that consumes the extracted features to recommend GridRival team selections.
* **Secondary Audience:** Any F1 data enthusiast who wants structured practice session analysis.

### 6. Key Features
* - **Session Data Ingestion:** Fetch and normalize raw data from OpenF1 API endpoints (laps, stints, car_data, weather, pit, drivers, sessions) for a given practice session.
* - **Stint Classification:** Classify each stint by purpose — qualifying simulation, long run, aero/systems check, or installation lap — using compound, stint length, tyre age, and pace signals.
* - **Pace Analysis:** Extract best lap time per compound, long-run average pace, and sector-level performance (best and mean) per driver.
* - **Degradation Analysis:** Compute tyre degradation rate (lap time slope over a stint), fuel-corrected long-run pace, and lap time consistency (standard deviation).
* - **Speed Analysis:** Extract and compare speed trap and intermediate speeds across stint types to surface straight-line competitiveness and low-fuel indicators.
* - **Session Context:** Capture weather conditions (track/air temperature, rainfall, wind) and session metadata as context for interpreting KPIs.
* - **Feature Assembly:** Aggregate all per-driver KPIs into a unified in-memory domain object suitable for downstream AI consumption.

### 7. Technology Stack
* **Language:** TypeScript (Node.js 22+)
* **Runtime:** tsx for development
* **HTTP Client:** Native fetch
* **Domain Models:** TypeScript interfaces and classes
* **Analysis:** No heavy dependencies — standard math where possible
* **Testing:** vitest
* **Deployment:** Library usage — no server, no database, no frontend
