
import { useState } from "react";
import "./styles.css";

/*
 * plant group configuration
 * each group contains its name and a short description
 */
const GROUPS = [
  ["Coal", "Cheap but slow"],
  ["Natural Gas", "Flexible"],
  ["Geothermal", "Cheap and steady"],
  ["Hydro", "Limited water"],
  ["Oil-based", "Most expensive"],
  ["Solar", "Daytime only"],
  ["Wind", "When it blows"],
];

/*
 * svg icons for each power plant
 * all icons use currentColor so their appearance follows the css theme
 */
const ICONS = {
  Coal: (
    <path d="M4 15l2.5-6L12 5.5 18 8l2.5 5.5L17.5 19H8zM12 5.5L10.5 12l4 2.5M10.5 12L6.5 9M14.5 14.5l3-1" />
  ),

  "Natural Gas": (
    <path d="M12 3c.8 3.2 5 5.2 5 10a5 5 0 0 1-10 0c0-2 .9-3.2 2.2-4.3.1 1.9.9 3 2 3.3C10.6 8.6 10.4 5.7 12 3z" />
  ),

  Geothermal: (
    <path d="M3 20h18M5 20l4.5-8h5L19 20M10 9c-1-1.2 1-2.2 0-3.6M14 9c-1-1.2 1-2.2 0-3.6" />
  ),

  Hydro: (
    <path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11zM9 14.5a3 3 0 0 0 3 3" />
  ),

  "Oil-based": (
    <path d="M6 6c0-1.1 2.7-2 6-2s6 .9 6 2v12c0 1.1-2.7 2-6 2s-6-.9-6-2zM6 6c0 1.1 2.7 2 6 2s6-.9 6-2M6 12c0 1.1 2.7 2 6 2s6-.9 6-2" />
  ),

  Solar: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),

  Wind: (
    <>
      <circle cx="12" cy="11" r="1.3" />
      <path d="M12 9.7V3.5M10.9 11.7l-5 3.2M13.1 11.7l5 3.2M12 12.3V21M9 21h6" />
    </>
  ),
};

/*
 * general simulation constants
 */

// extract all available power plant names from the group configuration
const ALL = GROUPS.map(([name]) => name);

// six four-hour blocks representing one day
const BLOCKS = ["B1", "B2", "B3", "B4", "B5", "B6"];

const HOURS = [
  "12-4 AM",
  "4-8 AM",
  "8 AM-12 NN",
  "12-4 PM",
  "4-8 PM",
  "8 PM-12 MN",
];

/*
 * predefined simulation configurations
 * each preset specifies the available plants and co2 restrictions
 */
const PRESETS = [
  {
    label: "Test 1",
    groups: ALL.filter((group) => group !== "Geothermal"),
    co2On: false,
    cap: "165000",
  },
  {
    label: "Test 2",
    groups: ALL.filter((group) => group !== "Solar"),
    co2On: true,
    cap: "180000",
  },
  {
    label: "Test 3",
    groups: ALL.filter((group) => group !== "Solar"),
    co2On: true,
    cap: "165000",
  },
];

/*
 * visual and numerical formatting utilities
 */

// dot scale used to visually represent power dispatch levels
// higher dispatch values produce darker dots
const DOTS = " ·•●";

const dot = (value, peak) => {
  const ratio = Number(value) / peak;

  return DOTS[
    ratio <= 0
      ? 0
      : Math.min(3, Math.ceil(ratio * 3))
  ];
};

// standard decimal formatting for monetary values
const fix2 = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

// format a number as philippine pesos
const peso = (value) =>
  "₱" + Number(value).toLocaleString("en-US", fix2);

// format megawatt values
const mw = (value) =>
  Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

// format simplex tableau values without thousands separators
const cell = (value) =>
  Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 4,
    useGrouping: false,
  });

/*
 * plant icon component
 * renders the corresponding svg icon based on the selected plant group
 */
function PlantIcon({ name }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/*
 * main application component
 * manages user inputs, simulation requests, and displayed results
 */
export default function App() {
  /*
   * application state
   */

  // currently selected power plant groups
  const [sel, setSel] = useState(new Set(ALL));

  // determines whether the daily co2 restriction is enabled
  const [co2On, setCo2On] = useState(false);

  // maximum allowed daily co2 emissions
  const [cap, setCap] = useState("");

  // indicates whether the backend is currently solving the problem
  const [busy, setBusy] = useState(false);

  // stores the response returned by the r backend
  const [res, setRes] = useState(null);

  // stores validation errors and backend messages
  const [msg, setMsg] = useState(null);

  // determines which output view is currently displayed
  const [tab, setTab] = useState("results");

  /*
   * plant selection handlers
   */

  // toggles the selection state of an individual power plant group
  const toggle = (name) => {
    const updatedSelection = new Set(sel);

    if (updatedSelection.has(name)) {
      updatedSelection.delete(name);
    } else {
      updatedSelection.add(name);
    }

    setSel(updatedSelection);
  };

  // loads a predefined test configuration into the application
  const preset = (configuration) => {
    setSel(new Set(configuration.groups));
    setCo2On(configuration.co2On);
    setCap(configuration.cap);
  };

  // selects every available power plant group
  const selectAll = () => {
    setSel(new Set(ALL));
  };

  // resets the application inputs and clears previous results
  const reset = () => {
    setSel(new Set());
    setCo2On(false);
    setCap("165000");
    setRes(null);
    setMsg(null);
  };

  /*
   * simulation handler
   * validates user inputs and sends the optimization problem to the r backend
   */
  async function solve() {
    // clear previous error messages before starting a new request
    setMsg(null);

    const capNum = Number(cap);

    // ensure that at least one power plant group is selected
    if (sel.size === 0) {
      setMsg("Select at least one plant group.");
      return;
    }

    // validate the co2 cap only when the restriction is enabled
    if (
      co2On &&
      (cap.trim() === "" || !isFinite(capNum) || capNum <= 0)
    ) {
      setMsg("The CO₂ cap must be a number greater than 0.");
      return;
    }

    // indicate that the application is processing the request
    setBusy(true);

    try {
      /*
       * send the optimization configuration to the backend
       * only selected plant groups are included in the request
       */
      const response = await fetch("/api/solve", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          groups: ALL.filter((group) => sel.has(group)),
          co2On,
          co2Cap: co2On ? capNum : null,
        }),
      });

      // parse the json response returned by the r plumber api
      const data = await response.json();

      // handle invalid inputs or backend execution errors
      if (data.status === "invalid" || data.status === "error") {
        setRes(null);
        setMsg(data.message);
      } else {
        // store successful results and return to the results tab
        setRes(data);
        setTab("results");
      }
    } catch {
      // handle connection failures when the backend is unavailable
      setRes(null);

      setMsg(
        "Cannot reach the R solver. Start it with:  Rscript run.R  (inside the backend folder)."
      );
    }

    // allow the user to submit another simulation
    setBusy(false);
  }

  /*
   * generates a short description for each predefined test case
   * displays excluded plant groups and the co2 configuration
   */
  const caption = (configuration) => {
    const excludedGroups = ALL.filter(
      (group) => !configuration.groups.includes(group)
    )
      .join(", ")
      .toLowerCase();

    const groupDescription = excludedGroups
      ? "No " + excludedGroups
      : "All groups";

    const co2Description = configuration.co2On
      ? "CO₂ cap " +
        Number(configuration.cap).toLocaleString("en-US") +
        " t"
      : "no CO₂ cap";

    return groupDescription + ", " + co2Description;
  };

  /*
   * application interface
   */
  return (
    <div className="app">

      {/* hero section with the animated ascii planet backdrop */}
      <header className="hero">
        <div className="skyline" aria-hidden="true">
          <ascii-art
            piece="planet-scale"
            label="Animated ASCII planet with a circling moon"
          ></ascii-art>
        </div>

        <div className="hero-copy">
          <h1>Luzon Grid Dispatch</h1>

          <p>
            Find the cheapest way to power Luzon for one day, solved
            with the simplex method. Prices are shown for each
            four-hour block.
          </p>
        </div>
      </header>

      <div className="layout">

        {/* left panel containing simulation configuration controls */}
        <div className="controls">

          {/* power plant selection */}
          <section className="card" aria-labelledby="h-plants">
            <div className="card-head">
              <h2 id="h-plants">Plant groups</h2>

              <div className="row">
                <button className="ghost" onClick={selectAll}>
                  Check all
                </button>

                <button className="ghost" onClick={reset}>
                  Reset
                </button>
              </div>
            </div>

            <div className="plants">
              {GROUPS.map(([name, description]) => (
                <label
                  key={name}
                  className={
                    "plant" + (sel.has(name) ? " on" : "")
                  }
                >
                  <input
                    type="checkbox"
                    checked={sel.has(name)}
                    onChange={() => toggle(name)}
                  />

                  <PlantIcon name={name} />

                  <span className="plant-text">
                    <b>{name}</b>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* co2 emission restriction configuration */}
          <section className="card" aria-labelledby="h-co2">
            <h2 id="h-co2">CO₂ cap</h2>

            <label className="switch">
              <input
                type="checkbox"
                checked={co2On}
                onChange={(event) =>
                  setCo2On(event.target.checked)
                }
              />

              Limit daily CO₂
            </label>

            <div className="row">
              <input
                className="num"
                type="number"
                min="0"
                step="any"
                value={cap}
                disabled={!co2On}
                placeholder="CO₂ cap"
                aria-label="CO₂ cap in tonnes per day"
                onChange={(event) => setCap(event.target.value)}
              />

              <span>t / day</span>
            </div>

            {/* submits the optimization request */}
            <button
              className="solve"
              onClick={solve}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Solving…
                </>
              ) : (
                "Solve"
              )}
            </button>

            {/* displays validation or backend errors */}
            {msg && (
              <div className="banner bad" role="alert">
                {msg}
              </div>
            )}
          </section>

          {/* predefined simulation test cases */}
          <section className="card" aria-labelledby="h-tests">
            <h2 id="h-tests">Test cases</h2>

            <div className="presets">
              {PRESETS.map((configuration) => (
                <button
                  key={configuration.label}
                  className="ghost preset"
                  onClick={() => preset(configuration)}
                >
                  <b>{configuration.label}</b>
                  <small>{caption(configuration)}</small>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* navigation between optimization results and simplex tableau */}
        <nav className="tabs" aria-label="Output views">
          <button
            className={tab === "results" ? "active" : ""}
            aria-pressed={tab === "results"}
            onClick={() => setTab("results")}
          >
            Results
          </button>

          <button
            className={tab === "tableau" ? "active" : ""}
            aria-pressed={tab === "tableau"}
            onClick={() => setTab("tableau")}
            disabled={!res || busy}
          >
            Simplex Tableau
          </button>
        </nav>

        {/* main output area */}
        <main>

          {/* show loading placeholders while the backend is solving */}
          {busy && <Skeleton />}

          {/* initial state before a successful simulation */}
          {!busy && !res && (
            <div className="card empty">
              <span className="glyphs" aria-hidden="true">
                · • ● • ·
              </span>

              Pick plant groups and press <b>Solve</b>.
            </div>
          )}

          {/* display optimization results */}
          {!busy && res && tab === "results" && (
            <Results res={res} />
          )}

          {/* display the simplex algorithm iterations */}
          {!busy && res && tab === "tableau" && (
            <Tableau
              key={
                res.tableaus.length +
                "-" +
                res.iterations +
                "-" +
                res.headers.length
              }
              res={res}
            />
          )}
        </main>
      </div>
    </div>
  );
}

/*
 * loading skeleton component
 * provides visual placeholders while the optimization request is running
 */
function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Solving">

      {/* placeholder cards for the summary statistics */}
      <div className="cards">
        {[0, 1, 2].map((index) => (
          <div key={index} className="stat skeleton" />
        ))}
      </div>

      {/* placeholder for the main results table */}
      <div className="card skeleton tall" />
    </div>
  );
}

/*
 * optimization results component
 * displays the solution status, cost, dispatch, and electricity prices
 */
function Results({ res }) {

  // determine whether the backend found an optimal solution
  const ok = res.status === "optimal";

  /*
   * find the largest dispatch value across all plant groups and time blocks
   * this value serves as the reference for the dot shading
   */
  const peak = ok
    ? Math.max(
        1,
        ...res.x.flatMap((row) =>
          row.values.map(Number)
        )
      )
    : 1;

  return (
    <>
      {/* optimization status banner */}
      <div className={"banner " + (ok ? "good" : "bad")}>
        {ok ? "Optimal solution found" : res.message}
      </div>

      {/* summary statistics */}
      <div className="cards">

        {/* total minimum operating cost */}
        {ok && (
          <div className="stat">
            <small>Total minimum cost, Z</small>
            <b>{peso(res.z)}</b>
          </div>
        )}

        {/* number of simplex iterations */}
        <div className="stat">
          <small>Number of iterations</small>
          <b>{res.iterations}</b>
        </div>

        {/* size of the linear programming problem */}
        <div className="stat">
          <small>LP setup</small>
          <b>
            {res.summary.unknowns} unknowns ·{" "}
            {res.summary.constraints} constraints
          </b>
        </div>
      </div>

      {/* dispatch and pricing tables are only available for optimal solutions */}
      {ok && (
        <>
          {/* power generation assigned to each plant group per block */}
          <div className="card">
            <h2>
              Dispatch x<sub>gt</sub> (MW)
            </h2>

            <table>
              <thead>
                <tr>
                  <th>Plant group</th>

                  {BLOCKS.map((block, index) => (
                    <th key={block}>
                      {block}
                      <small>{HOURS[index]}</small>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {res.x.map((row) => (
                  <tr key={row.group}>
                    <td>{row.group}</td>

                    {row.values.map((value, index) => (
                      <td key={index}>
                        {/* dot represents the relative dispatch level */}
                        <span className="glyph" aria-hidden="true">
                          {dot(value, peak)}
                        </span>

                        {mw(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* electricity prices for each four-hour block */}
          <div className="card">
            <h2>
              Price of electricity (₱ / MWh) = S<sub>t</sub> / 4
            </h2>

            <table>
              <thead>
                <tr>
                  <th>Block</th>

                  {BLOCKS.map((block) => (
                    <th key={block}>{block}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>Price</td>

                  {res.prices.map((value, index) => (
                    <td key={index}>
                      {Number(value).toLocaleString("en-US", fix2)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            {/* verify the objective value using the simplex shadow prices */}
            <p className="note">
              Check: Σ (RHS × S<sub>i</sub>) = {peso(res.check)},
              equal to Z.
            </p>
          </div>
        </>
      )}
    </>
  );
}

/*
 * simplex tableau component
 * allows users to inspect each iteration of the simplex method
 */
function Tableau({ res }) {

  // tracks the currently displayed simplex iteration
  const [i, setI] = useState(0);

  // retrieve the tableau corresponding to the selected iteration
  const snap = res.tableaus[i];

  // identify the first and final tableau
  const last = res.tableaus.length - 1;

  // number of decision variables and constraints
  const n = res.summary.unknowns;

  /*
   * pivot information
   * these values identify the pivot column and pivot row
   */
  const pc = snap.pivotCol;
  const pr = snap.pivotRow;

  /*
   * extract the current basic variables
   * variables with a value of zero are excluded from the display
   */
  const active = snap.basic
    .map((value, index) => [res.headers[index], value])
    .filter(([, value]) => value !== 0);

  return (
    <div className="card">

      {/* tableau iteration navigation */}
      <div className="row between">
        <div className="row">

          {/* navigate to the previous iteration */}
          <button
            className="ghost"
            disabled={i === 0}
            onClick={() => setI(i - 1)}
          >
            ◀
          </button>

          {/* directly select a specific tableau iteration */}
          <select
            value={i}
            onChange={(event) => setI(Number(event.target.value))}
          >
            {res.tableaus.map((_, index) => (
              <option key={index} value={index}>
                {index === 0
                  ? "Initial tableau"
                  : "Iteration " + index}
              </option>
            ))}
          </select>

          {/* navigate to the next iteration */}
          <button
            className="ghost"
            disabled={i === last}
            onClick={() => setI(i + 1)}
          >
            ▶
          </button>
        </div>

        {/* display pivot information for the current iteration */}
        <span className="note">
          {pc
            ? pr
              ? `Pivot column ${res.headers[pc - 1]} · pivot element ${cell(
                  snap.rows[pr - 1][pc - 1]
                )} (row R${pr})`
              : `Pivot column ${res.headers[pc - 1]} has no positive entry: no test ratio, so the problem is infeasible`
            : "No negative entry in the bottom row: optimal"}
        </span>
      </div>

      {/* simplex tableau matrix */}
      <div className="scroll">
        <table className="tab">
          <thead>
            <tr>
              <th>Row</th>

              {res.headers.map((header, columnIndex) => (
                <th
                  key={columnIndex}
                  className={
                    columnIndex + 1 === pc ? "pcol" : ""
                  }
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {snap.rows.map((row, rowIndex) => (

              /*
               * the bottom row represents the objective function
               * the pivot row and column are highlighted for easier inspection
               */
              <tr
                key={rowIndex}
                className={
                  rowIndex === n
                    ? "bottom"
                    : rowIndex + 1 === pr
                    ? "prow"
                    : ""
                }
              >
                <th>
                  {rowIndex === n ? "Z" : "R" + (rowIndex + 1)}
                </th>

                {row.map((value, columnIndex) => (
                  <td
                    key={columnIndex}
                    className={
                      (columnIndex + 1 === pc ? "pcol " : "") +
                      (rowIndex + 1 === pr &&
                      columnIndex + 1 === pc
                        ? "pivot"
                        : "")
                    }
                  >
                    {cell(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* current basic feasible solution */}
      <h2>Basic solution</h2>

      <div className="chips">
        {active.map(([header, value]) => (
          <span key={header}>
            {header} = {cell(value)}
          </span>
        ))}
      </div>

      <p className="note">All other variables are 0.</p>
    </div>
  );
}