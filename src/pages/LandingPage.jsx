import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  Shield,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "../components/Brand";
import { useAuth } from "../context/AuthContext";

const features = [
  {
    icon: BrainCircuit,
    title: "Verbal Intelligence",
    subtitle: "Vocabulary, codes, series, analogies",
    label: "REASONING",
  },
  {
    icon: Eye,
    title: "Non-Verbal Intelligence",
    subtitle: "Matrices, visual patterns, spatial logic",
    label: "VISUAL SKILLS",
  },
  {
    icon: BookOpen,
    title: "Academic Preparation",
    subtitle: "Science, English, mathematics & more",
    label: "KNOWLEDGE",
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  return (
    <div className="landing-shell">
      <header className="site-nav container">
        <Brand />
        <nav className="nav-actions" aria-label="Primary navigation">
          {user ? (
            <Link className="btn btn-dark btn-sm" to="/dashboard">
              My Dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link className="plain-link" to="/login">
                Log in
              </Link>
              <Link className="btn btn-dark btn-sm" to="/signup">
                Get started <ArrowRight size={16} />
              </Link>
            </>
          )}
        </nav>
      </header>
      <main>
        <section className="hero-wrap container">
          <div className="hero-content">
            <div className="kicker">
              <span className="live-dot" /> YOUR PATH TO PMA STARTS HERE
            </div>
            <h1>
              Train your mind.
              <br />
              <em>Earn your place.</em>
            </h1>
            <p>
              A dedicated preparation space for future cadets. Sharpen your
              intelligence, strengthen your academics, and prepare for every
              challenge with confidence.
            </p>
            <div className="hero-buttons">
              <Link
                className="btn btn-gold"
                to={user ? "/dashboard" : "/signup"}
              >
                Start your preparation <ArrowRight size={19} />
              </Link>
              <Link
                className="btn btn-ghost-light"
                to={user ? "/dashboard" : "/login"}
              >
                {user ? "Open dashboard" : " Login Here"}{" "}
                <ChevronRight size={18} />
              </Link>
            </div>
            <div className="hero-points">
              <span>
                <CheckCircle2 size={17} /> Three dedicated test types
              </span>
              <span>
                <CheckCircle2 size={17} /> Your own cadet dashboard
              </span>
            </div>
          </div>
          <div className="hero-panel" aria-hidden="true">
            <div className="hero-panel-top">
              <span>TRAINING DIVISIONS</span>
              <Shield size={20} />
            </div>
            <div className="hero-num">
              03<span>CORE AREAS</span>
            </div>
            <div className="hero-panel-lines">
              <span>01 — VERBAL</span>
              <span>02 — NON-VERBAL</span>
              <span>03 — ACADEMIC</span>
            </div>
            <div className="hero-panel-bot">
              <Sparkles size={17} /> FOCUS. PRACTICE. PROGRESS.
            </div>
          </div>
        </section>
        <section className="section feature-section container">
          <div className="section-heading">
            <div>
              <div className="overline">BUILT FOR YOUR PREPARATION</div>
              <h2>One mission. Three disciplines.</h2>
            </div>
            <p>
              Each test category stays separate, so you practice exactly what
              you choose.
            </p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, subtitle, label }, i) => (
              <article className="feature-card" key={title}>
                <div className="feature-top">
                  <span className="feature-icon">
                    <Icon size={24} />
                  </span>
                  <span className="feature-index">0{i + 1}</span>
                </div>
                <small>{label}</small>
                <h3>{title}</h3>
                <p>{subtitle}</p>
                <a className="feature-foot" href="https://pmalongcourse.com/pma-past-papers/" target="_blank" rel="noopener noreferrer" aria-label={`View past papers for ${title} (opens in a new tab)`}>
                  <span>View past papers</span>
                  <ArrowRight size={17} />
                </a>
              </article>
            ))}
          </div>
        </section>
        <section className="container closing-banner">
          <div>
            <div className="overline">READY TO BEGIN?</div>
            <h2>Your journey starts with one step.</h2>
            <p>
              Create your cadet account now. Your personal dashboard is waiting.
            </p>
          </div>
          <Link to={user ? "/dashboard" : "/signup"} className="btn btn-gold">
            {user ? "Go to dashboard" : "Join CadetPrep"}
            <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer container">
        <Brand />
        <span>
          Independent practice platform · Not affiliated with Pakistan Military
          Academy.
        </span>
      </footer>
    </div>
  );
}
