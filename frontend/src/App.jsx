import { useState } from "react";
import "./styles.css";

const GROUPS = [
  ["Coal", "Cheap but slow", "#5b5b5b"], ["Natural Gas", "Flexible", "#d98324"], ["Geothermal", "Cheap and steady", "#a4492f"],
  ["Hydro", "Limited water", "#2b7bb9"], ["Oil-based", "Most expensive", "#222"], ["Solar", "Daytime only", "#e0b400"], ["Wind", "When it blows", "#3a9d8f"],
];
const ALL = GROUPS.map((g) => g[0]);
const BLOCKS = ["B1", "B2", "B3", "B4", "B5", "B6"];
const HOURS = ["12-4 AM", "4-8 AM", "8 AM-12 NN", "12-4 PM", "4-8 PM", "8 PM-12 MN"];
const PRESETS = [
  { label: "Test 1", groups: ALL.filter((g) => g !== "Geothermal"), co2On: false, cap: "165000" },
  { label: "Test 2", groups: ALL.filter((g) => g !== "Solar"), co2On: true, cap: "180000" },
  { label: "Test 3", groups: ALL.filter((g) => g !== "Solar"), co2On: true, cap: "165000" },
];
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

  return (
    <div className="app">
      <header><h1>Luzon Grid Dispatch</h1><p>Cheapest way to run the grid for one day, solved with the simplex method (R) and shown here (React).</p></header>
      <div className="layout">
        <aside className="card">
          <h2>Plant groups</h2>
          <div className="row">
            <button className="ghost" onClick={() => setSel(new Set(ALL))}>Check All</button>
            <button className="ghost" onClick={() => { setSel(new Set()); setCo2On(false); setCap("165000"); setRes(null); setMsg(null); }}>Reset</button>
          </div>
          {GROUPS.map(([n, note, color]) => (
            <label key={n} className={"plant" + (sel.has(n) ? " on" : "")}>
              <input type="checkbox" checked={sel.has(n)} onChange={() => toggle(n)} />
              <span className="dot" style={{ background: color }} /><b>{n}</b><small>{note}</small>
            </label>
          ))}
          <h2>CO₂ cap</h2>
          <label className="switch"><input type="checkbox" checked={co2On} onChange={(e) => setCo2On(e.target.checked)} /> Limit daily CO₂</label>
          <div className="row">
            <input 
            className="num"
            type="number"
            min="0"
            step="any"
            value={cap} 
            disabled={!co2On}
            placeholder=" CO₂ cap" 
            onChange={(e) => setCap(e.target.value)} 
            />
            <span>t / day</span>
            </div>
          <button className="solve" onClick={solve} disabled={busy}>{busy ? "Solving…" : "Solve"}</button>
          {msg && <div className="banner bad">{msg}</div>}
          <h2>Test cases</h2>
          <div className="row">{PRESETS.map((p) => <button key={p.label} className="ghost" onClick={() => preset(p)}>{p.label}</button>)}</div>
        </aside>
        <main>
          <nav className="tabs">
            <button className={tab === "results" ? "active" : ""} onClick={() => setTab("results")}>Results</button>
            <button className={tab === "tableau" ? "active" : ""} onClick={() => setTab("tableau")} disabled={!res}>Simplex Tableau</button>
          </nav>
          {!res && <div className="card empty">Pick plant groups and press <b>Solve</b>.</div>}
          {res && tab === "results" && <Results res={res} />}
          {res && tab === "tableau" && <Tableau key={res.tableaus.length + "-" + res.iterations + "-" + res.headers.length} res={res} />}
        </main>
      </div>
    </div>
  );
}

function Results({ res }) {
  const ok = res.status === "optimal";
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
              <tbody>{res.x.map((r) => <tr key={r.group}><td>{r.group}</td>{r.values.map((v, i) => <td key={i}>{mw(v)}</td>)}</tr>)}</tbody></table></div>
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
