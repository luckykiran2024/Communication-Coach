"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import {
  brand,
  functions,
  goals,
  modules,
  scenarios,
  type LearningModule,
  type Scenario,
} from "@coach/core";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const managerKeyDefault = process.env.NEXT_PUBLIC_MANAGER_SCENARIO_KEY ?? "development-manager-key";
const developmentManagerMode = process.env.NODE_ENV !== "production";

type ScenarioRevision = {
  id: string;
  scenarioId: string;
  version: number;
  scenario: Scenario;
  changedBy: string | null;
  createdAt: string;
};

type ScenarioForm = {
  title: string;
  context: string;
  question: string;
  independentQuestion: string;
  module: LearningModule;
  goal: typeof goals[number];
  function: string;
  level: string;
};

const emptyScenario: ScenarioForm = {
  title: "",
  context: "",
  question: "",
  independentQuestion: "",
  module: "daily",
  goal: goals[0],
  function: "",
  level: "1",
};

// Interactive Voice Simulation Mock Data
const demoSimulations = [
  {
    id: "tech-debt",
    title: "Explaining Technical Debt to Leadership",
    module: "Management & Business (DIMA)",
    role: "Engineering Lead",
    coachPrompt: "The leadership team wants to ship new customer features next sprint, but our auth pipeline is at critical risk of failure. How do you present the trade-off?",
    userResponse: "If we don't address the auth queue bottleneck now, our database connection pooling will fail at peak traffic. Therefore, I recommend allocating 35% of engineering capacity this sprint to refactor the auth service before rolling out the billing update.",
    quote: "Therefore, I recommend allocating 35% of engineering capacity this sprint to refactor the auth service...",
    score: 94,
    passed: true,
    audioDuration: "0:24",
    rubricNotes: "Direct causal link established. Actionable capacity percentage proposed.",
  },
  {
    id: "product-roadmap",
    title: "Pushing Back on Urgent Executive Scope",
    module: "Daily Communication (TASC)",
    role: "Product Manager",
    coachPrompt: "A key stakeholder just asked to add customized analytics exports into tomorrow's release. Walk them through the decision.",
    userResponse: "I understand the urgency for executive reporting. However, pushing export pipelines into tomorrow's freeze introduces regression risk for customer checkouts. Instead, let us deliver the core dashboard on schedule and release the export add-on next Tuesday.",
    quote: "However, pushing export pipelines into tomorrow's freeze introduces regression risk... Instead, let us deliver core dashboard on schedule...",
    score: 92,
    passed: true,
    audioDuration: "0:21",
    rubricNotes: "Constructive boundary set with clear alternative timeline.",
  },
  {
    id: "cross-team",
    title: "Navigating Cross-Functional Deadlock",
    module: "Leadership & Speaking (MESSAGE)",
    role: "Director of Operations",
    coachPrompt: "Sales and Engineering are blaming each other for delayed enterprise onboardings. How do you frame the joint resolution meeting?",
    userResponse: "Our shared objective is reducing enterprise activation time from 14 days to 4 days. Blaming past handoffs does not solve customer churn. First, let us map the customer onboarding handoff points today, and then commit to mutual SLA milestones for next week.",
    quote: "First, let us map customer onboarding handoff points today, and then commit to mutual SLA milestones...",
    score: 96,
    passed: true,
    audioDuration: "0:26",
    rubricNotes: "Inspires collective accountability with clear operational first step.",
  },
];

export default function Page() {
  // Scenario Library State
  const [library, setLibrary] = useState<Scenario[]>(scenarios);
  const [selectedModule, setSelectedModule] = useState<LearningModule | "all">("all");
  const [selectedFunction, setSelectedFunction] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [previewScenario, setPreviewScenario] = useState<Scenario | null>(null);

  // Voice Simulator State
  const [activeSimIndex, setActiveSimIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simProgress, setSimProgress] = useState(0);

  // Manager Studio State (Preserved functionality)
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerKey, setManagerKey] = useState(managerKeyDefault);
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [managerToken, setManagerToken] = useState("");
  const [form, setForm] = useState(emptyScenario);
  const [managerMessage, setManagerMessage] = useState("");
  const [managerError, setManagerError] = useState("");
  const [revisions, setRevisions] = useState<ScenarioRevision[]>([]);

  // Simulation playback timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setSimProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 5;
        });
      }, 350);
    } else {
      setSimProgress(0);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Load scenarios from API if available
  useEffect(() => {
    fetch(`${apiUrl}/v1/scenarios/library`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.scenarios) setLibrary(data.scenarios);
      })
      .catch(() => undefined);
  }, []);

  const activeSim = demoSimulations[activeSimIndex];

  // Filtered Scenarios
  const filteredScenarios = useMemo(() => {
    return library.filter((item) => {
      const matchModule = selectedModule === "all" || item.module === selectedModule;
      const matchLevel = selectedLevel === "all" || String(item.level) === selectedLevel;
      const matchFunction =
        selectedFunction === "all" ||
        item.functions.length === 0 ||
        item.functions.includes(selectedFunction as (typeof functions)[number]);
      const matchSearch =
        search.trim() === "" ||
        `${item.title} ${item.context} ${item.focus} ${item.functions.join(" ")}`
          .toLowerCase()
          .includes(search.trim().toLowerCase());
      return matchModule && matchLevel && matchFunction && matchSearch;
    });
  }, [library, selectedModule, selectedLevel, selectedFunction, search]);

  // Manager Headers
  function managerHeaders(): Record<string, string> {
    return managerToken
      ? { "Content-Type": "application/json", Authorization: `Bearer ${managerToken}` }
      : { "Content-Type": "application/json", "x-manager-key": managerKey };
  }

  async function loadScenarioRevisions(id: string) {
    try {
      const response = await fetch(`${apiUrl}/v1/manager/scenarios/${id}/revisions`, {
        headers: managerHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status !== 404) throw new Error(data.error ?? "Could not load scenario history.");
        setRevisions([]);
        return;
      }
      setRevisions(data.revisions as ScenarioRevision[]);
    } catch (err) {
      setManagerError((err as Error).message);
    }
  }

  async function signInManager() {
    setManagerMessage("");
    setManagerError("");
    try {
      const response = await fetch(`${apiUrl}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: managerEmail, password: managerPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Manager sign-in failed.");
      setManagerToken(data.token);
      setManagerMessage("Manager session authenticated. You can now publish custom scenarios.");
    } catch (failure) {
      setManagerError((failure as Error).message);
    }
  }

  async function addScenario() {
    setManagerMessage("");
    setManagerError("");
    const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const selectedFunctions =
      form.function && functions.includes(form.function as (typeof functions)[number])
        ? [form.function as (typeof functions)[number]]
        : [];
    const newScenario: Scenario = {
      id: `manager-${slug}-${Date.now()}`,
      version: 1,
      module: form.module,
      functions: selectedFunctions,
      goal: form.goal,
      title: form.title.trim(),
      context: form.context.trim(),
      question: form.question.trim(),
      independentQuestion: form.independentQuestion.trim(),
      rubricVersion: `${form.module}-manager-1`,
      focus: "Manager-authored practice",
      level: Number(form.level),
    };

    if (
      !newScenario.title ||
      !newScenario.context ||
      !newScenario.question ||
      !newScenario.independentQuestion
    ) {
      setManagerError("Please complete the title, context, prompt and independent retry prompt.");
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/v1/manager/scenarios`, {
        method: "POST",
        headers: managerHeaders(),
        body: JSON.stringify(newScenario),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not add the scenario.");
      setLibrary((prev) => [data.scenario ?? newScenario, ...prev]);
      setForm(emptyScenario);
      setManagerMessage("Scenario successfully published to the practice library.");
    } catch (failure) {
      setManagerError((failure as Error).message);
    }
  }

  return (
    <>
      {/* Dynamic Background Mesh & Glow Orbs */}
      <div className="site-bg-effects" aria-hidden="true">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
        <div className="glow-orb-3" />
        <div className="mesh-grid" />
      </div>

      {/* Navigation Header */}
      <header className="header-nav">
        <div className="nav-container">
          <a href="#" className="brand-wrap">
            <div className="brand-logo-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-name">{brand.name}</span>
              <span className="brand-tagline-micro">From Thought To Impact</span>
            </div>
          </a>

          <nav className="nav-links">
            <a href="#simulator" className="nav-link">Live Voice Demo</a>
            <a href="#frameworks" className="nav-link">Frameworks</a>
            <a href="#scenarios" className="nav-link">Scenario Library</a>
            <a href="#pricing" className="nav-link">Plans & Pricing</a>
            <a href="#privacy" className="nav-link">Privacy & Security</a>
          </nav>

          <div className="nav-actions">
            <button
              onClick={() => setManagerOpen(!managerOpen)}
              className="btn btn-secondary btn-sm"
              title="Scenario Manager Studio"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5.5h16v13H4zM8 3.5h8M8 9h8M8 13h5" />
              </svg>
              {managerOpen ? "Close Studio" : "Manager Studio"}
            </button>
            <a href="https://expo.dev/accounts/luckysoma/projects/communication-platform/builds/1f683f97-1e34-49ff-ad5a-7adc2b2a4e3f" className="btn btn-primary btn-sm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Download APK
            </a>
          </div>
        </div>
      </header>

      <main className="page-wrapper">
        {/* HERO SECTION */}
        <section className="hero-section">
          <div className="hero-content-col">
            <div className="hero-pill">
              <span className="hero-pill-pulse" />
              Voice-First Professional Communication Engine
            </div>

            <h1 className="hero-title">
              From thought to impact. <br />
              <span className="text-gradient">Practice one focused session at a time.</span>
            </h1>

            <p className="hero-subtitle">
              Transform your daily standups, management decisions, and executive presentations with evidence-backed AI voice coaching. Real conversations, verifiable evidence quotes, and absolute privacy.
            </p>

            <div className="hero-actions-row">
              <a href="https://expo.dev/accounts/luckysoma/projects/communication-platform/builds/1f683f97-1e34-49ff-ad5a-7adc2b2a4e3f" className="btn btn-primary btn-lg">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Download Android APK (v0.1.0)
              </a>
              <a href="#simulator" className="btn btn-secondary btn-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Try Voice Simulator
              </a>
            </div>

            <div className="hero-metrics-strip">
              <div className="metric-item">
                <span className="metric-value">7 Min</span>
                <span className="metric-label">Focused Voice Session</span>
              </div>
              <div className="metric-item">
                <span className="metric-value">3 Core</span>
                <span className="metric-label">Methodical Frameworks</span>
              </div>
              <div className="metric-item">
                <span className="metric-value">100%</span>
                <span className="metric-label">Evidence-Quoted Rubric</span>
              </div>
              <div className="metric-item">
                <span className="metric-value">Zero</span>
                <span className="metric-label">Employer Surveillance</span>
              </div>
            </div>
          </div>

          {/* Hero Visual Mockup */}
          <div className="hero-visual-col">
            <div className="mockup-aura" />
            
            <div className="phone-device-frame">
              <div className="phone-inner-screen">
                <Image
                  src="/app-mockup.jpg"
                  alt="Communication Coach Mobile Voice Interface"
                  width={340}
                  height={620}
                  className="phone-mockup-img"
                  priority
                />
              </div>

              {/* Floating micro-badges */}
              <div className="floating-badge badge-top-right">
                <div className="floating-icon-wrap" style={{ background: "rgba(8, 168, 137, 0.2)", color: "#08A889" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <strong>Evidence Verified</strong>
                  <small>Direct quote assessment</small>
                </div>
              </div>

              <div className="floating-badge badge-bottom-left">
                <div className="floating-icon-wrap" style={{ background: "rgba(255, 92, 77, 0.2)", color: "#FF5C4D" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </svg>
                </div>
                <div>
                  <strong>Live Speaking Loop</strong>
                  <small>Investigate → Observe → Retry</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE VOICE COACHING SIMULATOR */}
        <section id="simulator" className="section-wrapper">
          <div className="section-head">
            <span className="section-eyebrow">Interactive Demonstration</span>
            <h2 className="section-title">See How Real Voice Coaching Works</h2>
            <p className="section-desc">
              Experience the core learning loop: the AI tests your response under realistic pressure, extracts evidence directly from your speech, and guides your independent retry.
            </p>
          </div>

          <div className="voice-simulator-card">
            <div className="sim-header">
              <div className="sim-scenario-selector">
                {demoSimulations.map((sim, index) => (
                  <button
                    key={sim.id}
                    onClick={() => {
                      setActiveSimIndex(index);
                      setIsPlaying(false);
                      setSimProgress(0);
                    }}
                    className={`sim-tab-btn ${activeSimIndex === index ? "active" : ""}`}
                  >
                    {sim.title}
                  </button>
                ))}
              </div>

              <div className="sim-time-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Session Allowance: 20:00 Daily
              </div>
            </div>

            <div className="sim-body-grid">
              {/* Speaker Pane */}
              <div className="sim-speaker-pane">
                <div>
                  <div className="sim-coach-turn">
                    <div className="sim-avatar">AI</div>
                    <div className="sim-bubble">
                      <div className="sim-bubble-role">Coach Context · {activeSim.module}</div>
                      <p className="sim-bubble-text">{activeSim.coachPrompt}</p>
                    </div>
                  </div>

                  <div className="sim-coach-turn" style={{ marginTop: "16px" }}>
                    <div className="sim-avatar" style={{ background: "rgba(59, 130, 246, 0.15)", borderColor: "rgba(59, 130, 246, 0.3)" }}>
                      You
                    </div>
                    <div className="sim-bubble" style={{ background: "rgba(255, 255, 255, 0.06)" }}>
                      <div className="sim-bubble-role" style={{ color: "#60A5FA" }}>Learner Response ({activeSim.role})</div>
                      <p className="sim-bubble-text">{activeSim.userResponse}</p>
                    </div>
                  </div>
                </div>

                {/* Animated Waveform Visualizer */}
                <div className="waveform-container">
                  <div className="eq-bars">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <div
                        key={i}
                        className={`eq-bar ${isPlaying ? "active" : ""}`}
                        style={{
                          height: isPlaying ? undefined : `${(Math.sin(i * 0.4) + 1.2) * 8}px`,
                        }}
                      />
                    ))}
                  </div>

                  <div className="sim-controls">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="sim-play-btn"
                      aria-label={isPlaying ? "Pause simulation" : "Play practice turn"}
                    >
                      {isPlaying ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      )}
                    </button>
                    <span style={{ fontSize: "13px", color: "var(--ink-secondary)" }}>
                      {isPlaying ? `Coaching Audio Active (${simProgress}%)` : `Simulate Voice Session (${activeSim.audioDuration})`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Evidence Assessment Pane */}
              <div className="sim-evidence-pane">
                <div className="evidence-title-row">
                  <h3 style={{ fontSize: "18px", fontWeight: 700 }}>Real-Time Evidence Audit</h3>
                  <div className="evidence-score-pill">Mastery Score: {activeSim.score}%</div>
                </div>

                <div className="evidence-quote-box">
                  <span>Quoted Learner Evidence</span>
                  <p>"{activeSim.quote}"</p>
                </div>

                <div className="evidence-checks-list">
                  <div className="evidence-check-item">
                    <div className="check-icon-circle">✓</div>
                    <span>Substantive primary argument (≥ 40 characters of structured thought)</span>
                  </div>
                  <div className="evidence-check-item">
                    <div className="check-icon-circle">✓</div>
                    <span>Causal framing ("because", "therefore", "impact", "data")</span>
                  </div>
                  <div className="evidence-check-item">
                    <div className="check-icon-circle">✓</div>
                    <span>Actionable proposal ("recommend", "allocate", "plan")</span>
                  </div>
                  <div className="evidence-check-item">
                    <div className="check-icon-circle">✓</div>
                    <span>Independent retry verified without generic filler detector</span>
                  </div>
                </div>

                <div style={{ marginTop: "20px", padding: "14px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase" }}>Pedagogical Impact</span>
                  <p style={{ fontSize: "12px", color: "var(--ink-muted)", marginTop: "4px" }}>
                    {activeSim.rubricNotes}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CORE METHODOLOGY & FRAMEWORKS */}
        <section id="frameworks" className="section-wrapper">
          <div className="section-head">
            <span className="section-eyebrow">Systematic Pedagogy</span>
            <h2 className="section-title">Three Rigorous Frameworks for Every Stage</h2>
            <p className="section-desc">
              Unlike generic chatbots that guess at grammar, Communication Coach builds lasting competence using three proven professional frameworks.
            </p>
          </div>

          <div className="framework-cards-grid">
            {/* Module 1: Daily */}
            <div className="framework-card">
              <span className="framework-card-badge">Module 1</span>
              <h3 className="framework-name">Daily Communication</h3>
              <div className="framework-acronym">TASC Framework (Thought · Articulation · Substance · Clarity)</div>
              <p className="framework-desc">
                Find your first thought quickly. Formulate crisp answers during ad-hoc questions, daily standups, and cross-team check-ins without stalling.
              </p>
              <ul className="framework-features-list">
                <li className="framework-feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Clarifying unstructured ideas rapidly
                </li>
                <li className="framework-feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Eliminating evasive speaking habits
                </li>
                <li className="framework-feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Mastering the 30-second concise update
                </li>
              </ul>
              <button
                onClick={() => setSelectedModule("daily")}
                className="btn btn-secondary btn-sm"
              >
                Explore Daily Scenarios
              </button>
            </div>

            {/* Module 2: Management */}
            <div className="framework-card">
              <span className="framework-card-badge" style={{ color: "#38C7D7" }}>Module 2</span>
              <h3 className="framework-name">Management & Business</h3>
              <div className="framework-acronym" style={{ color: "#38C7D7" }}>DIMA · CLEAR Framework</div>
              <p className="framework-desc">
                Convert messy data and complex operations into high-confidence decisions. Lead 1-on-1s, defend resource requests, and resolve team friction.
              </p>
              <ul className="framework-features-list">
                <li className="framework-feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Data → Insight → Metric → Action (DIMA)
                </li>
                <li className="framework-feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Delivering constructive, non-defensive feedback
                </li>
                <li className="framework-feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Handling aggressive stakeholder pushback
                </li>
              </ul>
              <button
                onClick={() => setSelectedModule("management")}
                className="btn btn-secondary btn-sm"
              >
                Explore Management Scenarios
              </button>
            </div>

            {/* Module 3: Leadership */}
            <div className="framework-card">
              <span className="framework-card-badge" style={{ color: "#E783D4" }}>Module 3</span>
              <h3 className="framework-name">Leadership & Speaking</h3>
              <div className="framework-acronym" style={{ color: "#E783D4" }}>MESSAGE Framework</div>
              <p className="framework-desc">
                Craft a message that moves your audience. Command the room during town halls, board pitches, and investor updates with narrative authority.
              </p>
              <ul className="framework-features-list">
                <li className="framework-feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Executive presence & vocal cadence
                </li>
                <li className="framework-feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Story-driven strategic change communication
                </li>
                <li className="framework-feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  High-stakes Q&A and hostile objection drills
                </li>
              </ul>
              <button
                onClick={() => setSelectedModule("leadership")}
                className="btn btn-secondary btn-sm"
              >
                Explore Leadership Scenarios
              </button>
            </div>
          </div>
        </section>

        {/* SCENARIO LIBRARY EXPLORER */}
        <section id="scenarios" className="section-wrapper">
          <div className="section-head">
            <span className="section-eyebrow">Practice Catalog</span>
            <h2 className="section-title">Explore 50+ Real-World Scenarios</h2>
            <p className="section-desc">
              Tailored by functional role, career level, and communication goal. Filter and inspect the exact drills used in our coaching engine.
            </p>
          </div>

          <div className="scenario-explorer-box">
            <div className="explorer-filters-bar">
              <div className="search-input-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input
                  type="text"
                  placeholder="Search scenarios by title, context, or topic..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="filter-selects-row">
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value as LearningModule | "all")}
                  className="filter-select"
                >
                  <option value="all">All Modules</option>
                  <option value="daily">Daily Communication</option>
                  <option value="management">Management & Business</option>
                  <option value="leadership">Leadership & Speaking</option>
                </select>

                <select
                  value={selectedFunction}
                  onChange={(e) => setSelectedFunction(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Functions</option>
                  {functions.map((fn) => (
                    <option key={fn} value={fn}>{fn}</option>
                  ))}
                </select>

                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Levels (1-5)</option>
                  <option value="1">Level 1 - Foundation</option>
                  <option value="2">Level 2 - Practiced</option>
                  <option value="3">Level 3 - Advanced</option>
                  <option value="4">Level 4 - Executive</option>
                  <option value="5">Level 5 - Master</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "16px", fontSize: "13px", color: "var(--ink-muted)" }}>
              Showing {filteredScenarios.length} interactive practice scenarios
            </div>

            <div className="scenarios-grid">
              {filteredScenarios.slice(0, 8).map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => setPreviewScenario(sc)}
                  className="scenario-card"
                >
                  <div className="scenario-top-meta">
                    <span className="scenario-level-tag">Level {sc.level}</span>
                    <span className="scenario-module-tag">
                      {sc.module === "daily" ? "Daily (TASC)" : sc.module === "management" ? "Management (DIMA)" : "Leadership (MESSAGE)"}
                    </span>
                  </div>

                  <h4>{sc.title}</h4>
                  <p className="scenario-context-text">
                    {sc.context.length > 130 ? sc.context.substring(0, 130) + "..." : sc.context}
                  </p>

                  <div className="scenario-card-foot">
                    <span>{sc.functions.join(", ") || "General Professional"}</span>
                    <span>View Drill Details →</span>
                  </div>
                </div>
              ))}
            </div>

            {filteredScenarios.length > 8 && (
              <div style={{ textAlign: "center", marginTop: "24px" }}>
                <span style={{ fontSize: "13px", color: "var(--ink-muted)" }}>
                  + {filteredScenarios.length - 8} additional scenarios available in the mobile app catalog.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* PRICING & SUBSCRIPTION PLANS */}
        <section id="pricing" className="section-wrapper">
          <div className="section-head">
            <span className="section-eyebrow">Simple, Honest Pricing</span>
            <h2 className="section-title">Clear Session Plans. Zero Surprises.</h2>
            <p className="section-desc">
              Every paid plan includes focused seven-minute sessions, two free starter sessions, evidence-linked feedback, and complete data privacy.
            </p>
          </div>

          <div className="pricing-grid">
            {/* Essential */}
            <div className="pricing-card">
              <h3 className="pricing-tier-name">Essential</h3>
              <p className="pricing-tier-desc">Ideal for early-career professionals building spoken fluency.</p>
              
              <div className="pricing-price-wrap">
                <span className="price-currency">₹</span>
                <span className="price-amount">299</span>
                <span className="price-period">/ month</span>
              </div>

              <div className="daily-allowance-badge">
                15 sessions per month
              </div>

              <ul className="pricing-features-list">
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Daily Communication (TASC)
                </li>
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Evidence quote assessments
                </li>
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Indian English coach voice
                </li>
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Local progress analytics
                </li>
              </ul>

              <a href="https://expo.dev/accounts/luckysoma/projects/communication-platform/builds/1f683f97-1e34-49ff-ad5a-7adc2b2a4e3f" className="btn btn-secondary">
                Get Started
              </a>
            </div>

            {/* Professional (Featured) */}
            <div className="pricing-card featured">
              <div className="popular-badge">Most Popular</div>
              <h3 className="pricing-tier-name">Professional</h3>
              <p className="pricing-tier-desc">For managers, engineers, and specialists driving business impact.</p>
              
              <div className="pricing-price-wrap">
                <span className="price-currency">₹</span>
                <span className="price-amount">399</span>
                <span className="price-period">/ month</span>
              </div>

              <div className="daily-allowance-badge" style={{ background: "rgba(255, 92, 77, 0.15)", color: "#FF7B6E" }}>
                20 sessions per month
              </div>

              <ul className="pricing-features-list">
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  TASC + DIMA · CLEAR Modules
                </li>
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Custom role-specific scenarios
                </li>
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  British, US & Indian accents
                </li>
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Independent retry verification
                </li>
              </ul>

              <a href="https://expo.dev/accounts/luckysoma/projects/communication-platform/builds/1f683f97-1e34-49ff-ad5a-7adc2b2a4e3f" className="btn btn-primary">
                Choose Professional
              </a>
            </div>

            {/* Executive */}
            <div className="pricing-card">
              <h3 className="pricing-tier-name">Executive</h3>
              <p className="pricing-tier-desc">For leaders, founders, and public speakers commanding audiences.</p>
              
              <div className="pricing-price-wrap">
                <span className="price-currency">₹</span>
                <span className="price-amount">699</span>
                <span className="price-period">/ month</span>
              </div>

              <div className="daily-allowance-badge">
                40 sessions per month
              </div>

              <ul className="pricing-features-list">
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  All 3 Framework Modules (MESSAGE)
                </li>
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Town hall & board pitch drills
                </li>
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Hostile Q&A objection handling
                </li>
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Priority voice synthesis pipeline
                </li>
              </ul>

              <a href="https://expo.dev/accounts/luckysoma/projects/communication-platform/builds/1f683f97-1e34-49ff-ad5a-7adc2b2a4e3f" className="btn btn-secondary">
                Select Executive
              </a>
            </div>

            {/* Extended Practice */}
            <div className="pricing-card">
              <h3 className="pricing-tier-name">Extended Practice</h3>
              <p className="pricing-tier-desc">Extended practice access for intensive communication development.</p>
              
              <div className="pricing-price-wrap">
                <span className="price-currency">₹</span>
                <span className="price-amount">799</span>
                <span className="price-period">/ month</span>
              </div>

              <div className="daily-allowance-badge" style={{ background: "rgba(8, 168, 137, 0.15)", color: "#22C6A4" }}>
                60 sessions per month
              </div>

              <ul className="pricing-features-list">
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  60 seven-minute sessions across all devices
                </li>
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Full access to all 3 modules
                </li>
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Manager scenario collaboration
                </li>
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Complete mastery export
                </li>
              </ul>

              <a href="https://expo.dev/accounts/luckysoma/projects/communication-platform/builds/1f683f97-1e34-49ff-ad5a-7adc2b2a4e3f" className="btn btn-secondary">
                Choose Extended
              </a>
            </div>
          </div>
        </section>

        {/* PRIVACY & PEDAGOGY COMMITMENT */}
        <section id="privacy" className="section-wrapper">
          <div className="section-head">
            <span className="section-eyebrow">Enterprise-Grade Trust</span>
            <h2 className="section-title">Built On Honest Pedagogy and Absolute Privacy</h2>
            <p className="section-desc">
              We reject the invasive surveillance models common in corporate learning tools. Your practice remains entirely yours.
            </p>
          </div>

          <div className="privacy-integrity-box">
            <div className="privacy-col">
              <div className="privacy-icon-pill">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <h3>No Employer Surveillance</h3>
              <p>
                Coaching sessions are strictly private. Employers never receive audio recordings or individual practice transcripts by default.
              </p>
            </div>

            <div className="privacy-col">
              <div className="privacy-icon-pill">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
              </div>
              <h3>Evidence-Backed Quotes</h3>
              <p>
                We never use fake filler-word counters. Every evaluation quotes the exact sentence you spoke, showing concrete causality and structural growth.
              </p>
            </div>

            <div className="privacy-col">
              <div className="privacy-icon-pill">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <h3>Honest Learning Science</h3>
              <p>
                No psychological, medical, or employability claims. Just structured, disciplined deliberate practice: investigate, observe evidence, and independently retry.
              </p>
            </div>
          </div>

          {/* DOWNLOAD BANNER */}
          <div className="apk-download-banner">
            <div className="apk-banner-copy">
              <h3>Get the Android App Today</h3>
              <p>
                Open the latest Android preview build, log in, and begin a focused seven-minute communication session whenever you choose.
              </p>
            </div>

            <div className="apk-banner-cta-group">
              <a href="https://expo.dev/accounts/luckysoma/projects/communication-platform/builds/1f683f97-1e34-49ff-ad5a-7adc2b2a4e3f" className="btn btn-primary btn-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Open Latest Android Build
              </a>
              <span className="apk-meta-notes">Android 10+ · Hosted securely by Expo</span>
            </div>
          </div>
        </section>

        {/* MANAGER STUDIO & SCENARIO AUTHORING (COLLAPSIBLE / OPTIONAL) */}
        {managerOpen && (
          <section className="manager-studio-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "22px", fontWeight: 700 }}>Manager & L&D Scenario Authoring Studio</h3>
                <p style={{ fontSize: "13px", color: "var(--ink-secondary)", marginTop: "4px" }}>
                  Publish organization-specific practice scenarios and manage revisions.
                </p>
              </div>
              <button onClick={() => setManagerOpen(false)} className="btn btn-secondary btn-sm">
                Close Studio
              </button>
            </div>

            {managerMessage && (
              <div style={{ margin: "16px 0", padding: "12px", background: "rgba(8, 168, 137, 0.15)", color: "var(--teal)", borderRadius: "8px", fontSize: "13px" }}>
                {managerMessage}
              </div>
            )}
            {managerError && (
              <div style={{ margin: "16px 0", padding: "12px", background: "rgba(255, 92, 77, 0.15)", color: "#FF7B6E", borderRadius: "8px", fontSize: "13px" }}>
                {managerError}
              </div>
            )}

            {!managerToken && (
              <div style={{ marginTop: "20px", padding: "18px", background: "rgba(0,0,0,0.3)", borderRadius: "10px" }}>
                <h4 style={{ fontSize: "14px", marginBottom: "12px" }}>Sign In with Manager Credentials</h4>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <input
                    type="email"
                    placeholder="manager@example.com"
                    value={managerEmail}
                    onChange={(e) => setManagerEmail(e.target.value)}
                    style={{ flex: 1, padding: "10px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", color: "white" }}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={managerPassword}
                    onChange={(e) => setManagerPassword(e.target.value)}
                    style={{ flex: 1, padding: "10px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-subtle)", color: "white" }}
                  />
                  <button onClick={signInManager} className="btn btn-primary btn-sm">Sign In</button>
                </div>
              </div>
            )}

            <div className="manager-form-grid">
              <label>
                Scenario Title
                <input
                  type="text"
                  placeholder="e.g. Navigating Budget Pushback with CFO"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>

              <label>
                Target Learning Module
                <select
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value as LearningModule })}
                >
                  <option value="daily">Daily Communication (TASC)</option>
                  <option value="management">Management & Business (DIMA)</option>
                  <option value="leadership">Leadership & Speaking (MESSAGE)</option>
                </select>
              </label>

              <label>
                Function / Domain
                <select
                  value={form.function}
                  onChange={(e) => setForm({ ...form, function: e.target.value })}
                >
                  <option value="">General / All Functions</option>
                  {functions.map((fn) => (
                    <option key={fn} value={fn}>{fn}</option>
                  ))}
                </select>
              </label>

              <label>
                Difficulty Level
                <select
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                >
                  <option value="1">Level 1 - Getting Started</option>
                  <option value="2">Level 2 - Practiced</option>
                  <option value="3">Level 3 - Advanced</option>
                  <option value="4">Level 4 - Executive</option>
                  <option value="5">Level 5 - Master</option>
                </select>
              </label>

              <label className="full-width">
                Organizational Context
                <textarea
                  rows={2}
                  placeholder="Describe the stakeholder, urgency, and underlying business tension..."
                  value={form.context}
                  onChange={(e) => setForm({ ...form, context: e.target.value })}
                />
              </label>

              <label className="full-width">
                Coach Practice Prompt
                <textarea
                  rows={2}
                  placeholder="The primary prompt the voice coach gives to the learner..."
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                />
              </label>

              <label className="full-width">
                Independent Retry Prompt
                <textarea
                  rows={2}
                  placeholder="Transfer prompt without hints to test retention..."
                  value={form.independentQuestion}
                  onChange={(e) => setForm({ ...form, independentQuestion: e.target.value })}
                />
              </label>
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={addScenario} className="btn btn-glow-teal">
                Publish Custom Scenario
              </button>
            </div>
          </section>
        )}

        {/* SCENARIO DETAIL MODAL */}
        {previewScenario && (
          <div className="scenario-modal-overlay" onClick={() => setPreviewScenario(null)}>
            <div className="scenario-modal-content" onClick={(e) => e.stopPropagation()}>
              <button
                className="modal-close-btn"
                onClick={() => setPreviewScenario(null)}
                aria-label="Close modal"
              >
                ✕
              </button>

              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "14px" }}>
                <span className="scenario-level-tag">Level {previewScenario.level}</span>
                <span className="scenario-module-tag" style={{ textTransform: "uppercase", letterSpacing: "1px" }}>
                  {previewScenario.module} Module
                </span>
              </div>

              <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "14px" }}>
                {previewScenario.title}
              </h2>

              <div style={{ marginBottom: "20px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--coral)", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Context & Tension
                </span>
                <p style={{ fontSize: "14px", color: "var(--ink-secondary)", marginTop: "6px", lineHeight: "1.6" }}>
                  {previewScenario.context}
                </p>
              </div>

              <div style={{ marginBottom: "20px", padding: "16px", background: "rgba(255, 92, 77, 0.08)", borderRadius: "10px", borderLeft: "3px solid var(--coral)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--coral)", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Primary Coach Prompt
                </span>
                <p style={{ fontSize: "14px", color: "var(--ink)", marginTop: "6px", fontStyle: "italic" }}>
                  "{previewScenario.question}"
                </p>
              </div>

              <div style={{ marginBottom: "24px", padding: "16px", background: "rgba(8, 168, 137, 0.08)", borderRadius: "10px", borderLeft: "3px solid var(--teal)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Independent Retry Drill
                </span>
                <p style={{ fontSize: "14px", color: "var(--ink)", marginTop: "6px" }}>
                  "{previewScenario.independentQuestion}"
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "18px", borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                  Focus: {previewScenario.focus} · Rubric: {previewScenario.rubricVersion}
                </div>
                <a href="https://expo.dev/accounts/luckysoma/projects/communication-platform/builds/1f683f97-1e34-49ff-ad5a-7adc2b2a4e3f" className="btn btn-primary btn-sm">
                  Practice in App →
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="brand-wrap">
              <div className="brand-logo-mark">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </div>
              <span className="brand-name">{brand.name}</span>
            </div>
            <p>
              Personalized, voice-first communication development engine. Built for Android, iOS, and Web.
            </p>
          </div>

          <div className="footer-col">
            <h5>Product</h5>
            <ul>
              <li><a href="#simulator">Voice Simulator</a></li>
              <li><a href="#frameworks">Methodology</a></li>
              <li><a href="#scenarios">Scenario Catalog</a></li>
              <li><a href="#pricing">Subscription Plans</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Platforms</h5>
            <ul>
              <li><a href="https://expo.dev/accounts/luckysoma/projects/communication-platform/builds/1f683f97-1e34-49ff-ad5a-7adc2b2a4e3f">Android Preview Build</a></li>
              <li><a href="#pricing">iOS TestFlight (Preview)</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); setManagerOpen(true); }}>Manager Studio</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Privacy & Trust</h5>
            <ul>
              <li><a href="#privacy">No Surveillance Policy</a></li>
              <li><a href="#privacy">Evidence Rubric Standards</a></li>
              <li><a href="#privacy">Data Retention Controls</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div>© {new Date().getFullYear()} {brand.name} (c2coach.work). All rights reserved. Target market: India & International.</div>
          <div>c2coach.work · Vercel DNS Active · Node 24 & Next.js 16</div>
        </div>
      </footer>
    </>
  );
}

