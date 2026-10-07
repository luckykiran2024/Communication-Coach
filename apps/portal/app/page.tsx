"use client";
import { useEffect, useState } from "react";
import { brand, functions, goals, modules, scenarios, type LearningModule, type Scenario } from "@coach/core";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const managerKeyDefault = process.env.NEXT_PUBLIC_MANAGER_SCENARIO_KEY ?? "development-manager-key";
const developmentManagerMode = process.env.NODE_ENV !== "production";
type ScenarioRevision = { id: string; scenarioId: string; version: number; scenario: Scenario; changedBy: string | null; createdAt: string };
type ScenarioForm = { title: string; context: string; question: string; independentQuestion: string; module: LearningModule; goal: typeof goals[number]; function: string; level: string };
const emptyScenario: ScenarioForm = { title: "", context: "", question: "", independentQuestion: "", module: "daily", goal: goals[0], function: "", level: "1" };
function VectorIcon({ kind }: { kind: "add" | "library" | "spark" }) {
  return <svg className="vector-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={kind === "add" ? "M12 5v14M5 12h14" : kind === "library" ? "M4 5.5h16v13H4zM8 3.5h8M8 9h8M8 13h5" : "M12 3l1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3z"} /></svg>;
}
export default function Page() {
  const [selected, setSelected] = useState<LearningModule>("daily");
  const [open, setOpen] = useState<string | null>(null);
  const [library, setLibrary] = useState<Scenario[]>(scenarios);
  const [managerOpen, setManagerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [managerKey, setManagerKey] = useState(managerKeyDefault);
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [managerToken, setManagerToken] = useState("");
  const [form, setForm] = useState(emptyScenario);
  const [managerMessage, setManagerMessage] = useState("");
  const [managerError, setManagerError] = useState("");
  const [revisions, setRevisions] = useState<ScenarioRevision[]>([]);
  useEffect(() => { fetch(`${apiUrl}/v1/scenarios/library`).then(response => response.ok ? response.json() : null).then(data => { if (data?.scenarios) setLibrary(data.scenarios); }).catch(() => undefined); }, []);
  const scenario = library.find(item => item.id === open);
  const visibleScenarios = library.filter(item => item.module === selected && (levelFilter === "all" || String(item.level) === levelFilter) && (search.trim() === "" || `${item.title} ${item.context} ${item.focus} ${item.functions.join(" ")}`.toLowerCase().includes(search.trim().toLowerCase())));
  function managerHeaders(): Record<string, string> { return managerToken ? { "Content-Type": "application/json", Authorization: `Bearer ${managerToken}` } : { "Content-Type": "application/json", "x-manager-key": managerKey }; }
  async function loadScenarioRevisions(id: string) {
    const response = await fetch(`${apiUrl}/v1/manager/scenarios/${id}/revisions`, { headers: managerHeaders() });
    const data = await response.json();
    if (!response.ok) { if (response.status !== 404) throw new Error(data.error ?? "Could not load scenario history."); setRevisions([]); return; }
    setRevisions(data.revisions as ScenarioRevision[]);
  }
  useEffect(() => {
    if (!managerOpen || !scenario) { setRevisions([]); return; }
    void loadScenarioRevisions(scenario.id).catch(failure => setManagerError((failure as Error).message));
  }, [managerOpen, open, managerToken, managerKey]);
  async function signInManager() {
    setManagerMessage(""); setManagerError("");
    try {
      const response = await fetch(`${apiUrl}/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: managerEmail, password: managerPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Manager sign-in failed.");
      setManagerToken(data.token); setManagerMessage("Manager session ready. New scenarios can be published.");
    } catch (failure) { setManagerError((failure as Error).message); }
  }
  async function addScenario() {
    setManagerMessage(""); setManagerError("");
    const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const selectedFunctions = form.function && functions.includes(form.function as typeof functions[number]) ? [form.function as typeof functions[number]] : [];
    const scenario: Scenario = { id: `manager-${slug}-${Date.now()}`, version: 1, module: form.module, functions: selectedFunctions, goal: form.goal, title: form.title.trim(), context: form.context.trim(), question: form.question.trim(), independentQuestion: form.independentQuestion.trim(), rubricVersion: `${form.module}-manager-1`, focus: "Manager-authored practice", level: Number(form.level) };
    if (!scenario.title || !scenario.context || !scenario.question || !scenario.independentQuestion) { setManagerError("Complete the title, context, prompt and independent retry prompt."); return; }
    try {
      const response = await fetch(`${apiUrl}/v1/manager/scenarios`, { method: "POST", headers: managerToken ? { "Content-Type": "application/json", Authorization: `Bearer ${managerToken}` } : { "Content-Type": "application/json", "x-manager-key": managerKey }, body: JSON.stringify(scenario) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not add the scenario.");
      setLibrary(current => [...current, data.scenario]); setOpen(data.scenario.id); setManagerMessage("Scenario added to the library as a draft. Publish it after review to make it available to learners."); setForm(emptyScenario);
    } catch (failure) { setManagerError((failure as Error).message); }
  }
  async function reviewScenario(id: string, status: "published" | "deprecated") {
    setManagerMessage(""); setManagerError("");
    const headers = managerHeaders();
    try {
      const response = await fetch(`${apiUrl}/v1/manager/scenarios/${id}/review`, { method: "POST", headers, body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update the review status.");
      setLibrary(current => current.map(item => item.id === id ? data.scenario : item)); setManagerMessage(data.message);
    } catch (failure) { setManagerError((failure as Error).message); }
  }
  async function rollbackScenario(id: string, revisionId: string) {
    setManagerMessage(""); setManagerError("");
    try {
      const response = await fetch(`${apiUrl}/v1/manager/scenarios/${id}/rollback`, { method: "POST", headers: managerHeaders(), body: JSON.stringify({ revisionId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not roll back the scenario.");
      setLibrary(current => current.map(item => item.id === id ? data.scenario : item));
      setManagerMessage(data.message);
      await loadScenarioRevisions(id);
    } catch (failure) { setManagerError((failure as Error).message); }
  }
  return <div className="workspace">
    <aside><a className="brand" href="/"><span className="brand-icon" aria-hidden="true">c<span>↗</span></span><span>{brand.name}<small>LEARNING WORKSPACE</small></span></a>
      <p className="nav-label">YOUR WORKSPACE</p><a className="nav active" href="#overview"><span aria-hidden="true">◫</span> Overview</a><a className="nav" href="#library"><VectorIcon kind="library" /> Scenario library</a><a className="nav" href="#manager-studio" onClick={() => setManagerOpen(true)}><VectorIcon kind="add" /> Manager studio</a><a className="nav" href="#roadmap"><span aria-hidden="true">◎</span> Development status</a>
      <div className="privacy"><span aria-hidden="true">◇</span><strong>Private by design</strong><p>Personal recordings and coaching conversations stay outside enterprise reports.</p></div>
      <div className="version">FOUNDATION BUILD · 0.1.0</div>
    </aside>
    <main id="overview"><header><span>Workspace <span className="slash">/</span> Overview</span><span className="badge">Development preview</span></header>
      <section className="intro"><div><p className="eyebrow">FROM THOUGHT TO IMPACT</p><h1>Better conversations.<br /><span>One practice at a time.</span></h1><p className="lead">A space to turn professional knowledge into clear,<br className="desktop" /> thoughtful communication.</p></div><a href="#library" className="button">Explore practice scenarios <span aria-hidden="true">↗</span></a></section>
      <section className="hero"><div className="hero-copy"><span className="pill">THE LEARNING APPROACH</span><h2>Find the thought.<br />Build the message.<br />Make it land.</h2><p>Personalized to your work. Grounded in what you actually say. Focused on one useful next step.</p><div className="hero-foot"><span className="tiny-dot" /> Practice, reflection, independent retry</div></div>
        <div className="voice-art" aria-hidden="true"><div className="orb"><div className="wave">{[20,38,63,91,52,115,76,44,66,32,16].map((height,index) => <i key={index} style={{ height }} />)}</div></div><div className="art-label">YOUR VOICE. YOUR PROGRESS.</div><div className="art-note">Voice interface illustration · not live audio</div></div>
      </section>
      <section id="library"><div className="section-top"><div><p className="eyebrow">PRACTICE WITH PURPOSE</p><h2>Three paths. One clearer voice.</h2></div><span className="caption">{library.length} scenarios · curated and manager-authored</span></div>
        <div className="module-grid">{modules.map((module,index) => <button key={module.id} className={"module " + (selected === module.id ? "selected" : "")} onClick={() => { setSelected(module.id); setOpen(null); }} aria-pressed={selected === module.id}><span className="module-number">0{index + 1}</span><h3>{module.title}</h3><p>{module.description}</p><span className="framework">{module.framework}<span aria-hidden="true">↗</span></span></button>)}</div>
        <div className="library-controls"><label>Search scenarios<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, focus or function" /></label><label>Mastery level<select value={levelFilter} onChange={event => setLevelFilter(event.target.value)}><option value="all">All levels</option>{[1, 2, 3, 4, 5].map(level => <option key={level} value={level}>Level {level}</option>)}</select></label></div>
        <p className="caption result-count">Showing {visibleScenarios.length} of {library.filter(item => item.module === selected).length} {modules.find(module => module.id === selected)?.title} scenarios</p>
        <div className="scenario-list">{visibleScenarios.map(item => <button key={item.id} className="scenario-row" onClick={() => setOpen(open === item.id ? null : item.id)} aria-expanded={open === item.id}><span className="scenario-symbol" aria-hidden="true">↗</span><span><strong>{item.title}</strong><small>{item.functions.join(" · ") || "Every professional"} · Level {item.level} · {item.focus}</small></span><span className="preview-link">{open === item.id ? "Close" : "Preview"} <span aria-hidden="true">→</span></span></button>)}</div>
        {scenario && <article className="scenario-detail"><p className="eyebrow">SCENARIO {scenario.version} · {scenario.rubricVersion} · {(scenario.reviewStatus ?? "published").toUpperCase()}</p><h3>{scenario.title}</h3><p>{scenario.context}</p><blockquote>{scenario.question}</blockquote><p className="caption">Independent transfer prompt: {scenario.independentQuestion}</p><p className="caption">This is authored practice content. It is not AI feedback or an assessment.</p>{managerOpen && scenario.reviewStatus === "draft" && <button className="button primary-button" onClick={() => void reviewScenario(scenario.id, "published")}>Publish for learner practice</button>}{managerOpen && revisions.length > 1 && <div className="revision-panel"><strong>Revision history</strong><span className="caption">Rollback always creates a draft for review.</span>{revisions.slice(0, -1).reverse().map(revision => <div className="revision-row" key={revision.id}><span><strong>Revision {revision.version}</strong><small>{revision.scenario.title} · {new Date(revision.createdAt).toLocaleString()}</small></span><button className="button" onClick={() => void rollbackScenario(scenario.id, revision.id)}>Roll back</button></div>)}</div>}</article>}
      </section>
      <section className="manager-studio" id="manager-studio"><div className="section-top"><div><p className="eyebrow">MANAGER STUDIO</p><h2>Add authored practice</h2></div><button className="button" onClick={() => setManagerOpen(!managerOpen)}><VectorIcon kind="add" /> {managerOpen ? "Close form" : "Add scenario"}</button></div>{managerOpen && <div className="manager-form"><p className="caption">{developmentManagerMode ? "Use the development key locally, or sign in with an approved manager account before publishing." : "Sign in with an approved manager account before publishing."}</p><label>Manager email<input value={managerEmail} onChange={event => setManagerEmail(event.target.value)} autoComplete="username" /></label><label>Manager password<input type="password" value={managerPassword} onChange={event => setManagerPassword(event.target.value)} autoComplete="current-password" /></label><button className="button manager-sign-in" onClick={() => void signInManager()}>Sign in as manager</button>{developmentManagerMode && <label>Development manager key<input value={managerKey} onChange={event => setManagerKey(event.target.value)} /></label>}<label>Scenario title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label>Module<select value={form.module} onChange={event => setForm({ ...form, module: event.target.value as LearningModule })}>{modules.map(module => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label><label>Function (optional)<select value={form.function} onChange={event => setForm({ ...form, function: event.target.value })}><option value="">Every professional</option>{functions.map(item => <option key={item}>{item}</option>)}</select></label><label>Goal<select value={form.goal} onChange={event => setForm({ ...form, goal: event.target.value as typeof form.goal })}>{goals.map(goal => <option key={goal}>{goal}</option>)}</select></label><label>Mastery level<select value={form.level} onChange={event => setForm({ ...form, level: event.target.value })}>{[1,2,3,4,5].map(level => <option key={level} value={level}>Level {level}</option>)}</select></label><label>Context<textarea value={form.context} onChange={event => setForm({ ...form, context: event.target.value })} /></label><label>Primary prompt<textarea value={form.question} onChange={event => setForm({ ...form, question: event.target.value })} /></label><label>Independent retry prompt<textarea value={form.independentQuestion} onChange={event => setForm({ ...form, independentQuestion: event.target.value })} /></label><button className="button primary-button" onClick={() => void addScenario()}><VectorIcon kind="add" /> Add to scenario library</button>{managerMessage && <p className="success-message">{managerMessage}</p>}{managerError && <p className="error-message">{managerError}</p>}</div>}</section>
      <section className="bottom-grid" id="roadmap"><article className="status-card"><p className="eyebrow">BUILDING THE FOUNDATION</p><h2>A thoughtful start.</h2><p>Account and profile APIs, personalized scenario selection, and native live AI coaching are implemented behind server configuration. Physical Android/iOS verification and production provider credentials are the remaining release gates.</p><div className="status-line"><span className="status-dot" /> Current milestone: native voice readiness</div></article><article className="status-card muted"><p className="eyebrow">ENTERPRISE LEARNING</p><h2>People, not rankings.</h2><p>Organization management and aggregate learning reports are planned. No learner analytics or employee records are exposed in this preview.</p><span className="coming">Enterprise tools · upcoming phase</span></article></section>
      <footer><span>{brand.name} <span className="slash">/</span> {brand.tagline}</span><span>English · India-first</span></footer>
    </main>
  </div>;
}
