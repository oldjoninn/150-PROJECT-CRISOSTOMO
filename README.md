# Luzon Grid Dispatch and Price Simulator

**CMSC 150 | R + React**

A power grid dispatch and electricity pricing simulator for the Luzon Grid, implemented using **R** for mathematical computation and **React** for the user interface.

The project implements a custom **Simplex Method** without relying on external optimization packages. The backend handles linear programming computations, while the frontend provides an interactive interface for configuring power generation sources, setting CO₂ emission limits, and viewing optimization results.

---

## Project Information

| Detail | Information |
|:---|:---|
| **Name** | Ralph Benedict V. Crisostomo |
| **Section** | C-1L |
| **Course** | CMSC 150 |
| **Backend** | R (Plumber, JSON) |
| **Frontend** | React (Vite) |
| **Optimization** | Custom Simplex Algorithm |

---

## System Architecture

The application follows a simple client-server architecture. React communicates with the R backend through a JSON API.

```text
┌──────────────────────┐
│    React + Vite      │
│   localhost:5173     │
└──────────┬───────────┘
           │
           │ POST /api/solve
           │ JSON Request
           ▼
┌──────────────────────┐
│     R Plumber API    │
│   localhost:8000     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│      simplex.R       │
│                      │
│  • LP Formulation    │
│  • Dual Conversion   │
│  • Simplex Method    │
│  • Result Extraction │
└──────────────────────┘
```

---

## Features

- **Power Plant Selection** – Select individual generation groups or use Check All and Reset controls.
- **CO₂ Emission Constraints** – Enable or disable carbon emission restrictions and specify a CO₂ cap.
- **Linear Programming Solver** – Solve the dispatch optimization problem using a custom-built Simplex implementation.
- **Optimization Results** – View the optimal objective value, generation decisions, and electricity prices.
- **Simplex Tableau Visualization** – Inspect the tableau at every iteration, including pivot information and basic solutions.
- **Input Validation** – Handles invalid inputs and infeasible optimization problems.

---

## Technologies Used

| Technology | Purpose |
|:---|:---|
| R 4.x | Mathematical computations and Simplex implementation |
| Plumber | REST API for the R backend |
| JSONlite | JSON serialization and deserialization |
| React | Interactive user interface |
| Vite | Frontend development server |
| JavaScript | API communication and interface logic |

---

##  Project Structure

```text
project/
│
├── backend/
│   ├── simplex.R       # LP formulation and Simplex solver
│   ├── api.R           # Plumber API endpoints
│   ├── run.R           # Backend entry point
│   └── test.R          # Solver test cases
│
└── frontend/
    ├── src/
    │   └── App.jsx     # Main application interface
    ├── package.json
    └── ...
```

---

##  Installation and Setup

### Prerequisites

Make sure the following are installed:

- [R 4.x](https://cran.r-project.org/)
- [Node.js 18+](https://nodejs.org/)
- npm (included with Node.js)

### 1. Install R Dependencies

Open R or an R terminal and execute:

```r
install.packages(c("plumber", "jsonlite"))
```

### 2. Install Frontend Dependencies

Navigate to the frontend directory:

```bash
cd frontend
npm install
```

### 3. Run the Application

The backend and frontend must run simultaneously in separate terminals.

**Terminal 1 – R Backend**

```bash
cd backend
Rscript run.R
```

The API will be available at:

`http://localhost:8000`

**Terminal 2 – React Frontend**

```bash
cd frontend
npm run dev
```

Open the application in your browser:

`http://localhost:5173`

---

##  Simplex Method Implementation

The optimization algorithm follows the procedures discussed in the CMSC 150 laboratory handout.

### Algorithm Workflow

**1. Matrix Construction**

The `build_lp()` function constructs the constraint matrix in `>=` form, with the objective coefficients included in the final column. Unselected generation groups are excluded from the model.

**2. Matrix Transposition**

The constraint matrix is transposed using `t(A)` inside `solve_lp()` to prepare the dual formulation.

**3. Dual Problem Construction**

The dual problem introduces variables \(S_1, S_2, \ldots, S_m\), while slack variables retain the original primal variable names \(x_1, x_2, \ldots, x_n\).

**4. Initial Tableau Formation**

The initial tableau is constructed as:

\[
\left[ t(A)\mid I\mid Z\mid c \right]
\]

With the bottom row:

\[
\left[ -b\mid 0\mid 1\mid 0 \right]
\]

The algorithm then performs the following operations:

- Selects the most negative entry in the bottom row as the entering variable.
- Determines the leaving variable using the smallest positive test ratio.
- Performs Gauss-Jordan elimination to update the tableau.
- Repeats until the optimality condition is satisfied or infeasibility is detected.

**5. Solution Extraction**

Once the algorithm terminates:

| Output | Extraction Method |
|:---|:---|
| Objective Value (Z) | Bottom-right tableau cell |
| Primal Variables (x) | Bottom row under the slack columns |
| Dual Variables (S) | Solution value of the column containing a single 1; otherwise 0 |
| Electricity Prices | \(S_t / 4\) |

---

##  Testing and Validation

The backend includes test cases based on the provided PDF test cases.

Run the test suite independently:

```bash
cd backend
Rscript test.R
```

### Expected Test Results

| Test Case | Expected Iterations | Expected Objective Value | Status |
|:---:|---:|---:|:---|
| Test 1 | 34 | 1,149,843,800.00 | Optimal |
| Test 2 | 39 | 1,181,240,745.45 | Optimal |
| Test 3 | 37 | — | Infeasible |

The test suite also includes invalid-input scenarios to verify the backend's input validation.

---

## 🔌 API Documentation

### `POST /solve`

Accepts a JSON request containing the selected generation groups and CO₂ emission settings.

**Example Request:**

```json
{
  "groups": ["Coal", "Natural Gas"],
  "co2On": true,
  "co2Cap": 165000
}
```

**Response Fields:**

| Field | Description |
|:---|:---|
| `status` | Optimization status (`optimal` or `infeasible`) |
| `iterations` | Number of Simplex iterations |
| `z` | Optimal objective value |
| `x` | Primal solution values |
| `prices` | Computed electricity prices |
| `summary` | Summary of optimization results |
| `tableaus` | Tableau snapshots for each iteration, including pivot information and basic solutions |

Invalid requests return **HTTP 400** with:

- `status: "invalid"`
- An explanatory error message.

### `GET /health`

Checks whether the backend API is running.

---

##  Notes

- The Simplex algorithm is implemented from scratch.
- No external optimization packages are used.
- The R backend is responsible for all mathematical computations.
- The React frontend communicates with the backend exclusively through the JSON API.
- The backend can be tested independently of the frontend.

---

*Developed as part of CMSC 150 – C-1L.*

**Ralph Benedict V. Crisostomo**  
University of the Philippines Los Baños