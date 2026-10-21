import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Clock3,
  Eye,
  LogOut,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import DashboardSidebar from "../components/DashboardSidebar";
import ProfileLink from "../components/ProfileLink";
import { useAuth } from "../context/AuthContext";

const courses = [
  {
    slug: "verbal",
    num: "01",
    icon: BrainCircuit,
    title: "Verbal Intelligence",
    type: "LOGIC & LANGUAGE",
    description:
      "Analogies, number & letter series, coding-decoding, classification, and comprehension.",
    color: "verbal",
    topics: [
      "Analytical reasoning",
      "Word and number series",
      "Coding & analogies",
    ],
  },
  {
    slug: "nonverbal",
    num: "02",
    icon: Eye,
    title: "Non-Verbal Intelligence",
    type: "VISUAL REASONING",
    description:
      "Image matrices, patterns, rotations, reflections, missing figures, and spatial relationships.",
    color: "nonverbal",
    topics: ["Shape sequences", "Matrix reasoning", "Visual classification"],
  },
  {
    slug: "academic",
    num: "03",
    icon: BookOpen,
    title: "Academic Preparation",
    type: "CORE KNOWLEDGE",
    description:
      "Mathematics, English, science, Pakistan Studies, Islamiat, and general knowledge.",
    color: "academic",
    topics: ["Science & mathematics", "English", "Pakistan Studies & GK"],
  },
];

export default function Dashboard() {
  const { user, signOut, avatarUrl } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const name = (
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Cadet"
  ).trim();
  const first = name.split(/\s+/)[0];
  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      setLogoutError(err.message || "Sign out failed. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <div className="dashboard-layout">
      <DashboardSidebar />
      <div className="dashboard-body">
        <header className="dashboard-topbar">

          <div className="topbar-account">
            <span className="member-chip">
              <span className="member-dot" /> CADET MEMBER
            </span>
            <ProfileLink user={user} avatarUrl={avatarUrl} />
            <button
              className="logout-btn"
              title="Sign out"
              onClick={logout}
              disabled={loggingOut}
            >
              <LogOut size={18} />
              <span>Sign out</span>
            </button>
          </div>
        </header>
        <main className="dashboard-content">
          <div className="dashboard-greeting">
            <div>
              <span className="overline">YOUR PERSONAL TRAINING SPACE</span>
              <h1>
                Welcome, {first}. <span>👋</span>
              </h1>
              <p>
                You're one step closer to your goal. Choose a category and build
                your confidence with consistent practice.
              </p>
            </div>
            <div className="dashboard-date">
              <CalendarDays size={16} />
              {new Intl.DateTimeFormat("en-PK", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(new Date())}
            </div>
          </div>
          {logoutError && (
            <div className="alert alert-error">
              <span>{logoutError}</span>
            </div>
          )}
          <section className="welcome-panel">
            <div className="welcome-overline">
              <Sparkles size={16} /> YOUR PREPARATION JOURNEY
            </div>
            <h2>Your mission starts here.</h2>
            <p>
              Three specialized test areas. One clear goal. Take your
              preparation one focused step at a time.
            </p>
            <div className="welcome-stats">
              <span>
                <Target size={18} /> 3 training categories
              </span>
              <span>
                <Clock3 size={18} /> 85 questions · 30 minutes
              </span>
              <span>
                <ShieldCheck size={18} /> Personal account active
              </span>
            </div>
            <div className="panel-watermark" aria-hidden="true">
              PMA
            </div>
          </section>
          <div className="course-title-row">
            <div>
              <div className="overline">SELECT YOUR DISCIPLINE</div>
              <h2>Choose your test category</h2>
              <p>
                Each test will contain questions from its own category only.
              </p>
            </div>
            <span className="course-count">03 CATEGORIES</span>
          </div>
          <div className="course-grid">
            {courses.map(
              ({
                slug,
                num,
                icon: Icon,
                title,
                type,
                description,
                color,
                topics,
              }) => (
                <article className={`course-card ${color}`} key={title}>
                  <div className="course-card-top">
                    <div className="course-icon">
                      <Icon size={24} />
                    </div>
                    <span className="course-number">{num}</span>
                  </div>
                  <div className="course-type">{type}</div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <div className="course-divider" />
                  <div className="course-topics">
                    {topics.map((t) => (
                      <span key={t}>
                        <span className="tiny-check">✓</span>
                        {t}
                      </span>
                    ))}
                  </div>
                  <Link
                    className="course-coming course-ready"
                    to={`/test/${slug}`}
                  >
                    Start training <ArrowRight size={18} />
                  </Link>
                </article>
              ),
            )}
          </div>
          <Link className="history-dashboard-link" to="/progress"><span className="history-stat-icon"><BarChart3 size={23} /></span><span><strong>See your progress</strong><small>Explore your test history, scores, and training trends.</small></span><ArrowRight size={20} /></Link>
          <div className="dashboard-note">
            <div className="note-icon">
              <UserRound size={20} />
            </div>
            <div>
              <strong>Account setup complete.</strong>
              <p>
                Your email is <strong>{user?.email}</strong>. Choose a category
                above to begin a timed practice test.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
