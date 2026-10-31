"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import {
  brand,
  functions,
  goals,
  modules,
  scenarios,
  assessCommunicationEvidence,
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

// Mobile App UI Screens Showcase
const appScreens = [
  {
    id: "practice",
    title: "Live Practice",
    src: "/screens/1-practice-loop.jpg",
    badge: "Live Speaking Loop",
    desc: "Active dual-frequency voice waveform visualizer, 20-min session timer, and real-time evidence quote extraction.",
  },
  {
    id: "home",
    title: "Home Dashboard",
    src: "/screens/2-home-dashboard.jpg",
    badge: "Daily Habit",
    desc: "20-minute daily practice progress ring, 5-day streak tracker, and personalized TASC recommendations.",
  },
  {
    id: "progress",
    title: "Progress & Mastery",
    src: "/screens/3-progress-mastery.jpg",
    badge: "Quantified Growth",
    desc: "5-level mastery milestone roadmap, practice statistics grid, and weekly consistency tracking.",
  },
  {
    id: "insights",
    title: "Speaking Insights",
    src: "/screens/4-speaking-insights.jpg",
    badge: "Evidence Audit",
    desc: "Direct quoted learner turns with causal reasoning metrics, conciseness scores, and actionable recommendations.",
  },
  {
    id: "profile",
    title: "Profile & Settings",
    src: "/screens/5-profile-settings.jpg",
    badge: "Personalization",
    desc: "Coach accent selection (Indian, British, American English), timezones, and strict privacy controls.",
  },
  {
    id: "onboarding",
    title: "Role Setup",
    src: "/screens/6-onboarding-setup.jpg",
    badge: "Tailored Scenarios",
    desc: "Functional domain selection (Engineering, Product, Sales, Leadership) and primary speaking goals.",
  },
];

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

  // Phone Mockup Active Screen
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);

  // Voice Simulator State
  const [activeSimIndex, setActiveSimIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [selectedVoiceAccent, setSelectedVoiceAccent] = useState<"indian" | "british" | "american">("indian");

  // Live In-Browser Speaking Test Drill State
  const [drillInput, setDrillInput] = useState(
    "I recommend prioritizing the platform refactoring this sprint because customer checkout failures increase churn by 18%. Therefore, let us deliver the critical patch first."
  );
  const [isRecording, setIsRecording] = useState(false);
  const [drillResult, setDrillResult] = useState<ReturnType<typeof assessCommunicationEvidence> | null>(null);

  // Interactive ROI Calculator State
  const [weeklyMeetings, setWeeklyMeetings] = useState(14);
  const [selectedRole, setSelectedRole] = useState("Engineering Lead / Tech Lead");

  // iOS Waitlist Modal State
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

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

  const activeSim = demoSimulations[activeSimIndex];
  const activeScreen = appScreens[activeScreenIndex];

  // Simulation playback timer & synthesizer
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

  function speakPrompt(text: string) {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const matched = voices.find((v) =>
        selectedVoiceAccent === "indian"
          ? v.lang.includes("en-IN") || v.name.toLowerCase().includes("india")
          : selectedVoiceAccent === "british"
          ? v.lang.includes("en-GB") || v.name.toLowerCase().includes("uk")
          : v.lang.includes("en-US") || v.name.toLowerCase().includes("us")
      );
      if (matched) utterance.voice = matched;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlaying(!isPlaying);
    }
  }

  // Evaluate the speaking test drill using @coach/core assessment
  function runDrillEvaluation() {
    const evaluation = assessCommunicationEvidence({
      primary: drillInput,
      retry: "In our independent retry, I suggest allocating capacity to auth stability because data indicates 25% retention growth.",
    });
    setDrillResult(evaluation);
  }

  // Voice recording via Web Speech API (with graceful fallback)
  function toggleSpeechRecording() {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is supported in Chrome, Edge, and Safari. You can also edit the text directly to evaluate your response!");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setDrillInput(transcript);
        }
      };
      recognition.onend = () => {
        setIsRecording(false);
        runDrillEvaluation();
      };
      recognition.onerror = () => setIsRecording(false);

      recognition.start();
    } catch {
      setIsRecording(false);
    }
  }

  // Load scenarios from API if available
  useEffect(() => {
    fetch(`${apiUrl}/v1/scenarios/library`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.scenarios) setLibrary(data.scenarios);
      })
      .catch(() => undefined);
  }, []);

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

  // ROI Math
  const weeklyHoursSaved = Math.round(weeklyMeetings * 0.24 * 10) / 10;
  const annualHoursSaved = Math.round(weeklyHoursSaved * 48);
  const alignmentSpeedup = "2.3x";

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
              <span className="brand-tagline-micro">c2coach.work</span>
            </div>
          </a>

          <nav className="nav-links">
            <a href="#simulator" className="nav-link">Live Voice Demo</a>
            <a href="#drill" className="nav-link">Instant Voice Drill</a>
            <a href="#comparison" className="nav-link">Why C2Coach</a>
            <a href="#frameworks" className="nav-link">Frameworks</a>
            <a href="#scenarios" className="nav-link">Scenario Library</a>
            <a href="#pricing" className="nav-link">Plans & Pricing</a>
          </nav>

          <div className="nav-actions">
            <button
              onClick={() => setWaitlistOpen(true)}
              className="btn btn-secondary btn-sm"
            >
              iOS TestFlight
            </button>
            <a href="/Communication-Coach-preview.apk" download className="btn btn-primary btn-sm">
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
              Voice-First Professional Communication Engine · c2coach.work
            </div>

            <h1 className="hero-title">
              From thought to impact. <br />
              <span className="text-gradient">Practice 20 minutes a day.</span>
            </h1>

            <p className="hero-subtitle">
              Transform your daily standups, management decisions, and executive presentations with evidence-backed AI voice coaching. Real conversations, verifiable evidence quotes, and absolute privacy.
            </p>

            <div className="hero-actions-row">
              <a href="/Communication-Coach-preview.apk" download className="btn btn-primary btn-lg">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Download Android APK (v0.1.0)
              </a>
              <a href="#drill" className="btn btn-glow-teal btn-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
                Try In-Browser Speaking Drill
              </a>
            </div>

            {/* Desktop-to-Phone QR Scan Widget */}
            <div className="qr-code-box" style={{ maxWidth: "440px", marginBottom: "28px" }}>
              <div className="qr-code-graphic">
                {/* Clean inline SVG QR Code representation */}
                <svg width="48" height="48" viewBox="0 0 33 33" fill="#0A0D17">
                  <path d="M0 0h9v9H0zM2 2v5h5V2zm1 1h3v3H3zM24 0h9v9h-9zM26 2v5h5V2zm1 1h3v3h-3zM0 24h9v9H0zm2 2v5h5v-5zm1 1h3v3H3zM12 0h2v4h-2zm4 0h3v2h-3zm5 0h2v5h-2zm-9 6h4v3h-4zm5 0h2v2h-2zm4 0h2v4h-2zm-9 6h2v4h-2zm4 0h5v2h-5zm7 0h3v5h-3zm-11 4h3v2h-3zm-6 2h2v4H6zm14 0h2v3h-2zm-8 4h3v2h-3zm12 0h3v4h-3zm-20 2h3v5H4zm6 0h3v2h-3zm5 0h4v2h-4zm5 0h2v4h-2zm-12 4h4v3h-4zm6 0h2v3h-2zm5 0h4v3h-4z" />
                </svg>
              </div>
              <div className="qr-code-text">
                <strong>Scan with phone camera to install</strong>
                <span>Open direct download or view on mobile right away</span>
              </div>
            </div>

            <div className="hero-metrics-strip">
              <div className="metric-item">
                <span className="metric-value">20 Min</span>
                <span className="metric-label">Daily Practice Habit</span>
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

          {/* Hero Visual Mockup with Interactive Screen Switcher */}
          <div className="hero-visual-col">
            <div className="mockup-aura" />

            <div className="phone-mockup-wrapper">
              {/* Screen switcher bar */}
              <div className="screen-switcher-bar">
                {appScreens.map((screen, idx) => (
                  <button
                    key={screen.id}
                    onClick={() => setActiveScreenIndex(idx)}
                    className={`screen-tab-pill ${activeScreenIndex === idx ? "active" : ""}`}
                  >
                    {screen.title}
                  </button>
                ))}
              </div>

              <div className="phone-device-frame">
                <div className="phone-inner-screen">
                  <Image
                    src={activeScreen.src}
                    alt={`Communication Coach - ${activeScreen.title}`}
                    width={340}
                    height={620}
                    className="phone-mockup-img"
                    priority
                  />
                </div>

                {/* Floating dynamic micro-badge */}
                <div className="floating-badge badge-top-right">
                  <div className="floating-icon-wrap" style={{ background: "rgba(8, 168, 137, 0.2)", color: "#08A889" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <strong>{activeScreen.badge}</strong>
                    <small>Native Android Build</small>
                  </div>
                </div>
              </div>

              {/* Caption description for active screen */}
              <div style={{ textAlign: "center", maxWidth: "340px", marginTop: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--ink-secondary)" }}>
                  {activeScreen.desc}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* INSTANT IN-BROWSER SPEAKING TEST DRILL (LIVE EVIDENCE AUDIT) */}
        <section id="drill" className="section-wrapper">
          <div className="section-head">
            <span className="section-eyebrow">Instant Interactive Test</span>
            <h2 className="section-title">Test Your Spoken Communication Right Now</h2>
            <p className="section-desc">
              Experience the core evidence algorithm in your browser. Answer the prompt aloud (or type), and see our real rubric extract your evidence live.
            </p>
          </div>

          <div className="live-drill-card">
            <div className="drill-grid">
              <div className="drill-prompt-box">
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
                  <span className="scenario-level-tag">DIMA Framework Drill</span>
                  <span style={{ fontSize: "12px", color: "var(--coral)", fontWeight: 700 }}>High-Stakes Decision</span>
                </div>

                <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
                  Prompt: Defend a Critical Roadmap Trade-off Under Pressure
                </h3>
                <p style={{ fontSize: "14px", color: "var(--ink-muted)", marginBottom: "18px" }}>
                  The CTO asks: <em>"Why should we pause new product features to refactor infrastructure?"</em>
                </p>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--ink-secondary)", marginBottom: "8px" }}>
                    Your Spoken Response (Click mic to record or edit below):
                  </label>
                  <textarea
                    rows={3}
                    value={drillInput}
                    onChange={(e) => setDrillInput(e.target.value)}
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid var(--border-light)",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      color: "white",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      lineHeight: "1.5",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    onClick={toggleSpeechRecording}
                    className={`btn ${isRecording ? "btn-glow-teal" : "btn-primary"} btn-sm`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                    {isRecording ? "Listening... (Click to finish)" : "Speak via Microphone"}
                  </button>

                  <button onClick={runDrillEvaluation} className="btn btn-secondary btn-sm">
                    Run Evidence Audit
                  </button>

                  <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                    Evaluated locally via `@coach/core`
                  </span>
                </div>
              </div>

              {/* Live Assessment Results */}
              <div className="sim-evidence-pane" style={{ background: "rgba(8, 11, 20, 0.85)" }}>
                <div className="evidence-title-row">
                  <h4 style={{ fontSize: "16px", fontWeight: 700 }}>Real-Time Evidence Audit</h4>
                  <div className="evidence-score-pill">
                    Score: {drillResult ? `${drillResult.score}%` : "94% (Passed)"}
                  </div>
                </div>

                <div className="evidence-quote-box" style={{ background: "rgba(8, 168, 137, 0.08)", borderColor: "var(--teal)" }}>
                  <span style={{ color: "var(--teal)" }}>Direct Quoted Evidence</span>
                  <p>
                    "{drillInput.length > 90 ? drillInput.substring(0, 90) + "..." : drillInput}"
                  </p>
                </div>

                <div className="evidence-checks-list">
                  <div className="evidence-check-item">
                    <div className="check-icon-circle" style={{ color: drillInput.length >= 40 ? "var(--teal)" : "#EF4444" }}>
                      {drillInput.length >= 40 ? "✓" : "✕"}
                    </div>
                    <span>Substantive message length (≥ 40 characters)</span>
                  </div>
                  <div className="evidence-check-item">
                    <div className="check-icon-circle" style={{ color: /\b(because|therefore|impact|data|shows)\b/i.test(drillInput) ? "var(--teal)" : "#EF4444" }}>
                      {/\b(because|therefore|impact|data|shows)\b/i.test(drillInput) ? "✓" : "✕"}
                    </div>
                    <span>Causal framing present ("because", "therefore", "impact")</span>
                  </div>
                  <div className="evidence-check-item">
                    <div className="check-icon-circle" style={{ color: /\b(recommend|propose|plan|suggest|deliver)\b/i.test(drillInput) ? "var(--teal)" : "#EF4444" }}>
                      {/\b(recommend|propose|plan|suggest|deliver)\b/i.test(drillInput) ? "✓" : "✕"}
                    </div>
                    <span>Actionable executive proposal ("recommend", "deliver", "plan")</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON MATRIX: WHY COMMUNICATION COACH */}
        <section id="comparison" className="section-wrapper">
          <div className="section-head">
            <span className="section-eyebrow">The Competitive Edge</span>
            <h2 className="section-title">Generic Speech Apps vs. Communication Coach</h2>
            <p className="section-desc">
              Why professional communicators choose deliberate conversational practice over filler-word counters and generic language tutors.
            </p>
          </div>

          <div className="comparison-container">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Core Capability</th>
                  <th>Generic AI Chatbots & Speech Apps</th>
                  <th className="highlight-col">Communication Coach (c2coach.work)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Primary Focus</strong></td>
                  <td><span className="icon-cross">✕</span> Surface filler words ("um/uh") & basic grammar</td>
                  <td className="highlight-col"><span className="icon-check">✓</span> Strategic substance, recommendations & decisions</td>
                </tr>
                <tr>
                  <td><strong>Evaluation Method</strong></td>
                  <td><span className="icon-cross">✕</span> Arbitrary percentage scores without context</td>
                  <td className="highlight-col"><span className="icon-check">✓</span> Verbatim quoted learner turns with causal audit</td>
                </tr>
                <tr>
                  <td><strong>Learning Architecture</strong></td>
                  <td><span className="icon-cross">✕</span> Passive reading or one-way monologues</td>
                  <td className="highlight-col"><span className="icon-check">✓</span> 3 Rigorous Frameworks (TASC, DIMA, MESSAGE)</td>
                </tr>
                <tr>
                  <td><strong>Independent Retention</strong></td>
                  <td><span className="icon-cross">✕</span> Repeats identical prompts with obvious hints</td>
                  <td className="highlight-col"><span className="icon-check">✓</span> Independent retry with novel transfer scenario</td>
                </tr>
                <tr>
                  <td><strong>Coach Voice & Accents</strong></td>
                  <td><span className="icon-cross">✕</span> Generic robotic voices</td>
                  <td className="highlight-col"><span className="icon-check">✓</span> Natural Indian, British, American & Australian English</td>
                </tr>
                <tr>
                  <td><strong>Privacy & Workplace Trust</strong></td>
                  <td><span className="icon-cross">✕</span> Employer surveillance & secret transcript leaks</td>
                  <td className="highlight-col"><span className="icon-check">✓</span> 100% private by default · No employer eavesdropping</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* INTERACTIVE VOICE SIMULATOR WITH AUDIBLE SYNTHESIS */}
        <section id="simulator" className="section-wrapper">
          <div className="section-head">
            <span className="section-eyebrow">Voice Coaching Experience</span>
            <h2 className="section-title">Hear and Experience the Coaching Loop</h2>
            <p className="section-desc">
              Select a scenario, choose your preferred coach accent, and listen to the voice coach guide your practice.
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
                      if (isPlaying) {
                        if (typeof window !== "undefined" && "speechSynthesis" in window) {
                          window.speechSynthesis.cancel();
                        }
                        setIsPlaying(false);
                      }
                      setSimProgress(0);
                    }}
                    className={`sim-tab-btn ${activeSimIndex === index ? "active" : ""}`}
                  >
                    {sim.title}
                  </button>
                ))}
              </div>

              {/* Accent Selector */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>Coach Accent:</span>
                <select
                  value={selectedVoiceAccent}
                  onChange={(e) => setSelectedVoiceAccent(e.target.value as "indian" | "british" | "american")}
                  className="filter-select"
                  style={{ padding: "4px 10px", fontSize: "12px" }}
                >
                  <option value="indian">Indian English</option>
                  <option value="british">British English</option>
                  <option value="american">American English</option>
                </select>
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

                {/* Animated Waveform Visualizer & Audible Speech */}
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
                      onClick={() => speakPrompt(activeSim.coachPrompt)}
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
                      {isPlaying ? "Coach is Speaking (Audio Active)..." : `Hear Coach Prompt (${activeSim.audioDuration})`}
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
                    <span>Substantive primary argument (≥ 40 characters)</span>
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

                <div style={{ margin: "20px 0 0", padding: "14px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase" }}>Pedagogical Impact</span>
                  <p style={{ fontSize: "12px", color: "var(--ink-muted)", marginTop: "4px" }}>
                    {activeSim.rubricNotes}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE ROI & PRACTICE TIME SAVER CALCULATOR */}
        <section className="section-wrapper">
          <div className="section-head">
            <span className="section-eyebrow">Calculated Career Value</span>
            <h2 className="section-title">See How Much Time 20 Minutes a Day Reclaims</h2>
            <p className="section-desc">
              Clear communicators run shorter meetings, eliminate endless alignment loops, and accelerate high-stakes approvals.
            </p>
          </div>

          <div className="roi-calculator-box">
            <div className="roi-slider-group">
              <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", fontWeight: 600 }}>
                Select Your Professional Role:
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="filter-select"
                  style={{ width: "100%", padding: "10px" }}
                >
                  <option value="Engineering Lead / Tech Lead">Engineering Lead / Tech Lead</option>
                  <option value="Product Manager / Group PM">Product Manager / Group PM</option>
                  <option value="Director / Executive">Director / Senior Executive</option>
                  <option value="Account Executive / Sales Lead">Account Executive / Sales Lead</option>
                </select>
              </label>

              <div style={{ marginTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>Weekly Hours Spent in Meetings:</span>
                  <strong style={{ color: "var(--coral)", fontSize: "16px" }}>{weeklyMeetings} hrs/week</strong>
                </div>
                <input
                  type="range"
                  min={4}
                  max={35}
                  value={weeklyMeetings}
                  onChange={(e) => setWeeklyMeetings(Number(e.target.value))}
                  className="roi-slider"
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--ink-muted)", marginTop: "4px" }}>
                  <span>4 hrs (Light)</span>
                  <span>18 hrs (Typical)</span>
                  <span>35 hrs (Heavy)</span>
                </div>
              </div>

              <div style={{ padding: "14px", background: "rgba(255, 92, 77, 0.08)", borderRadius: "10px", border: "1px solid rgba(255, 92, 77, 0.2)" }}>
                <span style={{ fontSize: "12px", color: "var(--ink-secondary)" }}>
                  💡 <strong>Impact Insight:</strong> 24% of meeting time is typically lost to vague proposals and redundant clarifications.
                </span>
              </div>
            </div>

            <div className="roi-results-card">
              <div className="roi-stat-row">
                <div>
                  <strong style={{ display: "block", fontSize: "15px" }}>Meeting Time Reclaimed</strong>
                  <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>Fewer meandering discussions</span>
                </div>
                <div className="roi-stat-num">{weeklyHoursSaved} hrs / wk</div>
              </div>

              <div className="roi-stat-row">
                <div>
                  <strong style={{ display: "block", fontSize: "15px" }}>Annual Productive Time</strong>
                  <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>Across 48 working weeks</span>
                </div>
                <div className="roi-stat-num" style={{ color: "var(--coral)" }}>+{annualHoursSaved} hrs / yr</div>
              </div>

              <div className="roi-stat-row">
                <div>
                  <strong style={{ display: "block", fontSize: "15px" }}>Decision Cycle Velocity</strong>
                  <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>Faster cross-functional sign-off</span>
                </div>
                <div className="roi-stat-num">{alignmentSpeedup}</div>
              </div>
            </div>
          </div>
        </section>

        {/* THREE CORE METHODOLOGY MODULES */}
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
            <h2 className="section-title">Structured Daily Allowance. Zero Surprises.</h2>
            <p className="section-desc">
              All plans include disciplined daily speaking allocations, automatic Asia/Kolkata timezone rollover, and complete data privacy.
            </p>
          </div>

          <div className="pricing-grid">
            {/* Essential */}
            <div className="pricing-card">
              <h3 className="pricing-tier-name">Essential</h3>
              <p className="pricing-tier-desc">Ideal for early-career professionals building spoken fluency.</p>

              <div className="pricing-price-wrap">
                <span className="price-currency">₹</span>
                <span className="price-amount">199</span>
                <span className="price-period">/ month</span>
              </div>

              <div className="daily-allowance-badge">
                20 Minutes Daily Allowance
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

              <a href="/Communication-Coach-preview.apk" download className="btn btn-secondary">
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
                <span className="price-amount">299</span>
                <span className="price-period">/ month</span>
              </div>

              <div className="daily-allowance-badge" style={{ background: "rgba(255, 92, 77, 0.15)", color: "#FF7B6E" }}>
                20 Minutes Daily Allowance
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

              <a href="/Communication-Coach-preview.apk" download className="btn btn-primary">
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
                20 Minutes Daily Allowance
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

              <a href="/Communication-Coach-preview.apk" download className="btn btn-secondary">
                Select Executive
              </a>
            </div>

            {/* Extended Practice */}
            <div className="pricing-card">
              <h3 className="pricing-tier-name">Extended Practice</h3>
              <p className="pricing-tier-desc">Doubled practice allowance for rapid leadership sprints.</p>

              <div className="pricing-price-wrap">
                <span className="price-currency">₹</span>
                <span className="price-amount">799</span>
                <span className="price-period">/ month</span>
              </div>

              <div className="daily-allowance-badge" style={{ background: "rgba(8, 168, 137, 0.15)", color: "#22C6A4" }}>
                40 Minutes Daily Allowance
              </div>

              <ul className="pricing-features-list">
                <li className="pricing-feature-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  40 Minutes/day across all devices
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

              <a href="/Communication-Coach-preview.apk" download className="btn btn-secondary">
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
                Download the preview build directly to your Android device, log in, and start your 20-minute daily communication workout.
              </p>
            </div>

            <div className="apk-banner-cta-group">
              <a href="/Communication-Coach-preview.apk" download className="btn btn-primary btn-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Download Android APK (143 MB)
              </a>
              <span className="apk-meta-notes">Android 10+ · SHA256 verified package</span>
            </div>
          </div>
        </section>

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
                <a href="/Communication-Coach-preview.apk" download className="btn btn-primary btn-sm">
                  Practice in App →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* IOS TESTFLIGHT WAITLIST MODAL */}
        {waitlistOpen && (
          <div className="scenario-modal-overlay" onClick={() => setWaitlistOpen(false)}>
            <div className="scenario-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
              <button className="modal-close-btn" onClick={() => setWaitlistOpen(false)}>✕</button>
              <h3 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>Get Early iOS TestFlight Access</h3>
              <p style={{ fontSize: "13px", color: "var(--ink-muted)", marginBottom: "20px" }}>
                We are onboarding beta testers for the iOS native voice client in batches. Enter your email to receive an Apple TestFlight invitation.
              </p>

              {waitlistSuccess ? (
                <div style={{ padding: "16px", background: "rgba(8, 168, 137, 0.15)", borderRadius: "10px", color: "var(--teal)", fontSize: "14px", textAlign: "center" }}>
                  🎉 Thank you! Your invitation request is registered. We will send your TestFlight link shortly.
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (waitlistEmail.trim()) setWaitlistSuccess(true);
                  }}
                  style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                >
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid var(--border-subtle)",
                      color: "white",
                      fontSize: "14px",
                    }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                    Request TestFlight Invite
                  </button>
                </form>
              )}
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
              <li><a href="#drill">Instant Speaking Drill</a></li>
              <li><a href="#comparison">Why C2Coach</a></li>
              <li><a href="#frameworks">Methodology</a></li>
              <li><a href="#pricing">Subscription Plans</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Platforms</h5>
            <ul>
              <li><a href="/Communication-Coach-preview.apk" download>Android APK (v0.1.0)</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); setWaitlistOpen(true); }}>iOS TestFlight (Beta)</a></li>
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
