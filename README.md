# Luzon Grid Dispatch and Price Simulator (CMSC 150) - R + React

R does the math (own simplex, no optimization packages). React is the interface. They talk over a small JSON API.

```
React (Vite, :5173)  --POST /api/solve-->  R plumber API (:8000)  -->  simplex.R
```

## Install (once)
- R 4.x with two packages: `install.packages(c("plumber", "jsonlite"))`
- Node.js 18+, then inside `frontend/`: `npm install`

## Run (two terminals)
1. `cd backend` then `Rscript run.R` (API on http://localhost:8000)
2. `cd frontend` then `npm run dev` (open http://localhost:5173)

Check the solver alone against the PDF test cases: `cd backend` then `Rscript test.R`.
- Test 1: 34 iterations, Z = 1,149,843,800.00
- Test 2: 39 iterations, Z = 1,181,240,745.45
- Test 3: infeasible, 37 iterations

## Files
| File | Job |
|---|---|
| `backend/simplex.R` | Data tables, `build_lp` (matrix), transpose + dual tableau, `solve_lp` (pivoting), `solve_request` (validation + answers) |
| `backend/api.R`, `run.R` | plumber API: `POST /solve`, `GET /health` |
| `backend/test.R` | Test cases 1-3 and the invalid-input cases |
| `frontend/src/App.jsx` | UI: plant checkboxes (Check All / Reset), CO2 toggle + limit, Solve, Results tab, Simplex Tableau tab |

## How the method maps to the code (lab handout steps)
1. Matrix: `build_lp` builds the constraints in ">=" form as rows with the objective `h*c` last. Unselected groups are removed.
2. Transpose: `t(A)` in `solve_lp`.
3. Dual: variables S1..Sm; the slack variables keep the primal names x1..xn.
4. Initial tableau `[ t(A) | I | Z | c ]` with bottom row `[ -b | 0 | 1 | 0 ]`, then pivot (most negative bottom entry, smallest test ratio, Gauss-Jordan).
5. Answer: Z = bottom-right cell, x = bottom row under the slack columns, S_i = Solution value of the column's single 1 (else 0), price = S_t / 4.

## API
`POST /solve` with body `{"groups": ["Coal", ...], "co2On": true, "co2Cap": 165000}`.
Returns `status` (`optimal` or `infeasible`), `iterations`, `z`, `x`, `prices`, `summary`, and `tableaus` (one snapshot per iteration with the pivot and basic solution).
Invalid input returns HTTP 400 with `status: "invalid"` and a message.

## To finish for submission
- Rename the folder and zip to `<LASTNAME>_150PROJECT.zip`.
- Write the User Manual: install, how to use the interface, how to read the shadow prices, and one worked example (Test 1 from this app works well).
