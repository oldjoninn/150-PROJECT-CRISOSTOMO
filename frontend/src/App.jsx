import { useState } from "react";
import "./styles.css";

/*
 * ASCII design reference
 * ----------------------
 * Hero skyline: "planet scale" by @bas3line, an animated ASCII scene of a dark
 * planet cut by two chasms, backlit, with a moon circling it.
 *   Piece:   https://ascii.rest/planet-scale/
 *   Library: https://github.com/bas3line/ascii  (MIT). Loaded as the <ascii-art> tag
 *            by the script in index.html, so there is no npm package to install.
 * Why it fits: a quiet monochrome backdrop that lets the results stay the brightest thing on the page.
 * Also borrowed from the piece:
 *   - its greyscale palette, see styles.css (orange and gold stay as the only colours)
 *   - the scene itself, kept fixed behind the frosted-glass panels
 *   - its halftone dot scale " ·•●", used below to shade the dispatch table
 */

const GROUPS = [
  ["Coal", "Cheap but slow"], ["Natural Gas", "Flexible"], ["Geothermal", "Cheap and steady"],
  ["Hydro", "Limited water"], ["Oil-based", "Most expensive"], ["Solar", "Daytime only"], ["Wind", "When it blows"],
];
// Monochrome line icons (24x24, drawn in currentColor so the page palette sets their colour)
const ICONS = {
  Coal: <path d="M4 15l2.5-6L12 5.5 18 8l2.5 5.5L17.5 19H8zM12 5.5L10.5 12l4 2.5M10.5 12L6.5 9M14.5 14.5l3-1" />,
  "Natural Gas": <path d="M12 3c.8 3.2 5 5.2 5 10a5 5 0 0 1-10 0c0-2 .9-3.2 2.2-4.3.1 1.9.9 3 2 3.3C10.6 8.6 10.4 5.7 12 3z" />,
  Geothermal: <path d="M3 20h18M5 20l4.5-8h5L19 20M10 9c-1-1.2 1-2.2 0-3.6M14 9c-1-1.2 1-2.2 0-3.6" />,
  Hydro: <path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11zM9 14.5a3 3 0 0 0 3 3" />,
  "Oil-based": <path d="M6 6c0-1.1 2.7-2 6-2s6 .9 6 2v12c0 1.1-2.7 2-6 2s-6-.9-6-2zM6 6c0 1.1 2.7 2 6 2s6-.9 6-2M6 12c0 1.1 2.7 2 6 2s6-.9 6-2" />,
  Solar: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  Wind: <><circle cx="12" cy="11" r="1.3" /><path d="M12 9.7V3.5M10.9 11.7l-5 3.2M13.1 11.7l5 3.2M12 12.3V21M9 21h6" /></>,
};
const PlantIcon = ({ name }) => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
);
const ALL = GROUPS.map((g) => g[0]);
const BLOCKS = ["B1", "B2", "B3", "B4", "B5", "B6"];
const HOURS = ["12-4 AM", "4-8 AM", "8 AM-12 NN", "12-4 PM", "4-8 PM", "8 PM-12 MN"];
const PRESETS = [
  { label: "Test 1", groups: ALL.filter((g) => g !== "Geothermal"), co2On: false, cap: "165000" },
  { label: "Test 2", groups: ALL.filter((g) => g !== "Solar"), co2On: true, cap: "180000" },
  { label: "Test 3", groups: ALL.filter((g) => g !== "Solar"), co2On: true, cap: "165000" },
];
const DOTS = " ·•●"; // dot scale from the planet scale piece: empty, light, medium, heavy
const dot = (v, peak) => { const r = Number(v) / peak; return DOTS[r <= 0 ? 0 : Math.min(3, Math.ceil(r * 3))]; };
const fix2 = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
const peso = (v) => "₱" + Number(v).toLocaleString("en-US", fix2);
const mw = (v) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
const cell = (v) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 4, useGrouping: false });

export default function App() {
  const [sel, setSel] = useState(new Set(ALL));
  const [co2On, setCo2On] = useState(false);
  const [cap, setCap] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [msg, setMsg] = useState(null);
  const [tab, setTab] = useState("results");

  const toggle = (n) => { const s = new Set(sel); s.has(n) ? s.delete(n) : s.add(n); setSel(s); };
  const preset = (p) => { setSel(new Set(p.groups)); setCo2On(p.co2On); setCap(p.cap); };

  async function solve() {
    setMsg(null);
    const capNum = Number(cap);
    if (sel.size === 0) return setMsg("Select at least one plant group.");
    if (co2On && (cap.trim() === "" || !isFinite(capNum) || capNum <= 0)) return setMsg("The CO₂ cap must be a number greater than 0.");
    setBusy(true);
    try {
      const r = await fetch("/api/solve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: ALL.filter((g) => sel.has(g)), co2On, co2Cap: co2On ? capNum : null }),
      });
      const data = await r.json();
      if (data.status === "invalid" || data.status === "error") { setRes(null); setMsg(data.message); }
      else { setRes(data); setTab("results"); }
    } catch {
      setRes(null); setMsg("Cannot reach the R solver. Start it with:  Rscript run.R  (inside the backend folder).");
    }
    setBusy(false);
  }

  const caption = (p) => {
    const out = ALL.filter((g) => !p.groups.includes(g)).join(", ").toLowerCase();
    return (out ? "No " + out : "All groups") + ", " + (p.co2On ? "CO₂ cap " + Number(p.cap).toLocaleString("en-US") + " t" : "no CO₂ cap");
  };

  return (
    <div className="app">
      <header className="hero">
        {/* Animated ASCII backdrop, "planet scale" by @bas3line: https://ascii.rest/planet-scale/ */}
        <div className="skyline" aria-hidden="true"><ascii-art piece="planet-scale" label="Animated ASCII planet with a circling moon"></ascii-art></div>
        <div className="hero-copy"><h1>Luzon Grid Dispatch</h1><p>Find the cheapest way to power Luzon for one day, solved with the simplex method. Prices are shown for each four-hour block.</p></div>
      </header>
      <div className="layout">
        <div className="controls">
          <section className="card" aria-labelledby="h-plants">
            <div className="card-head">
              <h2 id="h-plants">Plant groups</h2>
              <div className="row">
                <button className="ghost" onClick={() => setSel(new Set(ALL))}>Check all</button>
                <button className="ghost" onClick={() => { setSel(new Set()); setCo2On(false); setCap("165000"); setRes(null); setMsg(null); }}>Reset</button>
              </div>
            </div>
            <div className="plants">
              {GROUPS.map(([n, note]) => (
                <label key={n} className={"plant" + (sel.has(n) ? " on" : "")}>
                  <input type="checkbox" checked={sel.has(n)} onChange={() => toggle(n)} />
                  <PlantIcon name={n} />
                  <span className="plant-text"><b>{n}</b><small>{note}</small></span>
                </label>
              ))}
            </div>
          </section>
          <section className="card" aria-labelledby="h-co2">
            <h2 id="h-co2">CO₂ cap</h2>
            <label className="switch"><input type="checkbox" checked={co2On} onChange={(e) => setCo2On(e.target.checked)} /> Limit daily CO₂</label>
            <div className="row">
              <input className="num" type="number" min="0" step="any" value={cap} disabled={!co2On} placeholder="CO₂ cap" aria-label="CO₂ cap in tonnes per day" onChange={(e) => setCap(e.target.value)} />
              <span>t / day</span>
            </div>
            <button className="solve" onClick={solve} disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Solving…</> : "Solve"}</button>
            {msg && <div className="banner bad" role="alert">{msg}</div>}
          </section>
          <section className="card" aria-labelledby="h-tests">
            <h2 id="h-tests">Test cases</h2>
            <div className="presets">{PRESETS.map((p) => <button key={p.label} className="ghost preset" onClick={() => preset(p)}><b>{p.label}</b><small>{caption(p)}</small></button>)}</div>
          </section>
        </div>
        <nav className="tabs" aria-label="Output views">
          <button className={tab === "results" ? "active" : ""} aria-pressed={tab === "results"} onClick={() => setTab("results")}>Results</button>
          <button className={tab === "tableau" ? "active" : ""} aria-pressed={tab === "tableau"} onClick={() => setTab("tableau")} disabled={!res || busy}>Simplex Tableau</button>
        </nav>
        <main>
          {busy && <Skeleton />}
          {!busy && !res && <div className="card empty"><span className="glyphs" aria-hidden="true">· • ● • ·</span>Pick plant groups and press <b>Solve</b>.</div>}
          {!busy && res && tab === "results" && <Results res={res} />}
          {!busy && res && tab === "tableau" && <Tableau key={res.tableaus.length + "-" + res.iterations + "-" + res.headers.length} res={res} />}
        </main>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Solving">
      <div className="cards">{[0, 1, 2].map((i) => <div key={i} className="stat skeleton" />)}</div>
      <div className="card skeleton tall" />
    </div>
  );
}

function Results({ res }) {
  const ok = res.status === "optimal";
  const peak = ok ? Math.max(1, ...res.x.flatMap((r) => r.values.map(Number))) : 1; // largest dispatch, for the dot shading
  return (
    <>
      <div className={"banner " + (ok ? "good" : "bad")}>{ok ? "Optimal solution found" : res.message}</div>
      <div className="cards">
        {ok && <div className="stat"><small>Total minimum cost, Z</small><b>{peso(res.z)}</b></div>}
        <div className="stat"><small>Number of iterations</small><b>{res.iterations}</b></div>
        <div className="stat"><small>LP setup</small><b>{res.summary.unknowns} unknowns · {res.summary.constraints} constraints</b></div>
      </div>
      {ok && (
        <>
          <div className="card"><h2>Dispatch x<sub>gt</sub> (MW)</h2>
            <table><thead><tr><th>Plant group</th>{BLOCKS.map((b, i) => <th key={b}>{b}<small>{HOURS[i]}</small></th>)}</tr></thead>
              <tbody>{res.x.map((r) => <tr key={r.group}><td>{r.group}</td>{r.values.map((v, i) => <td key={i}><span className="glyph" aria-hidden="true">{dot(v, peak)}</span>{mw(v)}</td>)}</tr>)}</tbody></table></div>
          <div className="card"><h2>Price of electricity (₱ / MWh) = S<sub>t</sub> / 4</h2>
            <table><thead><tr><th>Block</th>{BLOCKS.map((b) => <th key={b}>{b}</th>)}</tr></thead>
              <tbody><tr><td>Price</td>{res.prices.map((v, i) => <td key={i}>{Number(v).toLocaleString("en-US", fix2)}</td>)}</tr></tbody></table>
            <p className="note">Check: Σ (RHS × S<sub>i</sub>) = {peso(res.check)}, equal to Z.</p></div>
        </>
      )}
    </>
  );
}

function Tableau({ res }) {
  const [i, setI] = useState(0);
  const snap = res.tableaus[i], last = res.tableaus.length - 1, n = res.summary.unknowns;
  const pc = snap.pivotCol, pr = snap.pivotRow;
  const active = snap.basic.map((v, j) => [res.headers[j], v]).filter(([, v]) => v !== 0);
  return (
    <div className="card">
      <div className="row between">
        <div className="row"><button className="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>◀</button>
          <select value={i} onChange={(e) => setI(Number(e.target.value))}>{res.tableaus.map((_, k) => <option key={k} value={k}>{k === 0 ? "Initial tableau" : "Iteration " + k}</option>)}</select>
          <button className="ghost" disabled={i === last} onClick={() => setI(i + 1)}>▶</button></div>
        <span className="note">{pc ? (pr ? `Pivot column ${res.headers[pc - 1]} · pivot element ${cell(snap.rows[pr - 1][pc - 1])} (row R${pr})` : `Pivot column ${res.headers[pc - 1]} has no positive entry: no test ratio, so the problem is infeasible`) : "No negative entry in the bottom row: optimal"}</span>
      </div>
      <div className="scroll"><table className="tab">
        <thead><tr><th>Row</th>{res.headers.map((h, c) => <th key={c} className={c + 1 === pc ? "pcol" : ""}>{h}</th>)}</tr></thead>
        <tbody>{snap.rows.map((r, ri) => (
          <tr key={ri} className={ri === n ? "bottom" : ri + 1 === pr ? "prow" : ""}>
            <th>{ri === n ? "Z" : "R" + (ri + 1)}</th>
            {r.map((v, ci) => <td key={ci} className={(ci + 1 === pc ? "pcol " : "") + (ri + 1 === pr && ci + 1 === pc ? "pivot" : "")}>{cell(v)}</td>)}
          </tr>))}</tbody></table></div>
      <h2>Basic solution</h2>
      <div className="chips">{active.map(([h, v]) => <span key={h}>{h} = {cell(v)}</span>)}</div>
      <p className="note">All other variables are 0.</p>
    </div>
  );
}