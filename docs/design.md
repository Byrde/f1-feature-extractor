# Domain-Driven Design (DDD) Strategy

### 1. Ubiquitous Language Glossary
| Term | Definition | Aliases |
| :--- | :--- | :--- |
| **Meeting** | A Grand Prix or testing weekend, containing multiple sessions. Identified by `meeting_key`. | Grand Prix, Race Weekend |
| **Session** | A distinct period of track activity (FP1, FP2, FP3, Qualifying, Race). Identified by `session_key`. | Practice Session |
| **Stint** | A continuous period of driving by a driver between pit stops, on a single set of tyres. | Run |
| **Stint Type** | Classification of a stint's purpose: quali sim, long run, aero/systems check, or installation lap. | Run Type |
| **Quali Sim** | A short stint on fresh soft tyres at low fuel, simulating qualifying pace. Typically 1-3 push laps. | Qualifying Simulation |
| **Long Run** | A stint of 5+ timed laps on the same compound, used to assess sustained race pace. | Race Simulation, High-Fuel Run |
| **Compound** | The tyre type used during a stint: SOFT, MEDIUM, HARD, INTERMEDIATE, or WET. | Tyre Compound |
| **Degradation** | The rate at which lap times increase over consecutive laps on the same tyre, measured in seconds per lap. | Tyre Deg, Deg Rate |
| **Fuel Correction** | An approximate adjustment (~0.06s/lap) applied to lap times to normalize for decreasing fuel load over a stint. | Fuel Adjustment |
| **Speed Trap** | A fixed point on track where the car's top speed is measured. | ST Speed |
| **Intermediate Speed** | Speed measured at intermediate points (I1, I2) along the lap. | Sector Speed |
| **Feature Vector** | The complete set of extracted KPIs for a single driver in a single session. | Driver Features, Session Features |
| **Lap** | A single circuit of the track by a driver, with timing and speed data. | |
| **Pit Out Lap** | The lap immediately after leaving the pit lane; typically slow and excluded from pace analysis. | Out Lap |

### 2. Core Domain and Bounded Context
* **Core Domain:** Feature extraction — transforming raw practice session data into classified stints and meaningful KPIs that predict qualifying and race performance.

* **Bounded Contexts:**
    * - **Ingestion:** Fetches and normalizes raw data from the OpenF1 API into domain objects. Owns the API client, rate limiting, and data mapping. Language: API-centric (endpoints, responses, session_key, driver_number).
    * - **Analysis:** Classifies stints and computes all KPIs (pace, degradation, speed, consistency). Consumes normalized domain objects from Ingestion. Language: racing-centric (stint type, degradation rate, long-run pace, quali sim).
    * - **Session:** Assembles per-driver feature vectors and provides the public interface for consumers. Orchestrates Ingestion and Analysis. Language: feature-centric (feature vector, driver session summary).

### 3. Aggregates

* **Session Aggregate**
    * **Aggregate Root:** `Session`
    * **Entities:** `DriverSession` (a driver's participation within the session)
    * **Value Objects:** `Lap`, `Stint`, `WeatherSnapshot`, `PitStop`
    * **Description:** Represents a complete practice session with all driver data. The root ensures all laps and stints are associated with valid drivers within the session. Stints are enriched with a `stint_type` classification. Weather snapshots provide temporal context.

* **DriverFeatures Aggregate**
    * **Aggregate Root:** `DriverFeatures`
    * **Value Objects:** `PaceMetrics`, `DegradationMetrics`, `SpeedMetrics`, `ConsistencyMetrics`, `StintSummary`
    * **Description:** The output artifact. Contains the complete feature vector for a single driver in a single session. Immutable once assembled. Each metrics value object encapsulates a specific analysis dimension. `StintSummary` captures per-stint classification and key stats.
