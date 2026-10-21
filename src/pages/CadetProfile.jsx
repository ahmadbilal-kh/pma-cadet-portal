import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  LockKeyhole,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import DashboardSidebar from "../components/DashboardSidebar";
import CadetAvatar from "../components/CadetAvatar";
import { useAuth } from "../context/AuthContext";
import { validateAvatarFile } from "../lib/avatar";

export default function CadetProfile() {
  const { user, updateProfile, updateAvatar, avatarUrl, signOut } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const photoInput = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoNotice, setPhotoNotice] = useState("");
  const savedName = user?.user_metadata?.full_name || "";
  const [fullName, setFullName] = useState(savedName);
  const previousName = useRef(savedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const name = savedName || "Cadet";
  const created = user?.created_at ? new Date(user.created_at) : null;
  const joined =
    created && !Number.isNaN(created.getTime())
      ? new Intl.DateTimeFormat("en-PK", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(created)
      : "Not available";

  useEffect(() => {
    const oldName = previousName.current;
    setFullName((value) => (value === oldName ? savedName : value));
    previousName.current = savedName;
  }, [savedName]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      setLogoutError(err?.message || "Sign out failed. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  async function changePhoto(file) {
    if (photoBusy || busy) return;
    setPhotoError("");
    setPhotoNotice("");
    try {
      if (file) validateAvatarFile(file);
      setPhotoBusy(true);
      await updateAvatar(file);
      setPhotoNotice(file ? "Profile photo saved." : "Profile photo removed.");
    } catch (err) {
      setPhotoError(
        err?.message || "Unable to save your photo. Please try again.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    if (busy || photoBusy) return;
    setError("");
    setNotice("");
    const value = fullName.trim();
    if (value.length < 2 || value.length > 80) {
      setError("Enter your full name (2 to 80 characters).");
      return;
    }
    setBusy(true);
    try {
      const updated = await updateProfile(value);
      setFullName(updated.user_metadata?.full_name || value);
      setNotice("Your profile has been saved.");
    } catch (err) {
      setError(
        err?.message || "Unable to save your profile. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="dashboard-layout dashboard-v2">
      <DashboardSidebar />
      <div className="dashboard-body">
        <header className="dashboard-topbar profile-topbar">
          <Link className="back-link" to="/dashboard">
            <ArrowLeft size={16} />
            Back to home
          </Link>
          <div className="topbar-account">
            <button
              type="button"
              className="logout-btn"
              aria-label="Sign out"
              onClick={logout}
              disabled={loggingOut || busy || photoBusy}
            >
              <LogOut size={17} />
              <span>{loggingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        </header>
        <main className="dashboard-content profile-content">
          {logoutError && (
            <div className="alert alert-error" role="alert">
              {logoutError}
            </div>
          )}
          <div className="d-greeting">
             <div>
              <span className="d-eyebrow">YOUR CADET ACCOUNT</span>
              <h1>Cadet Profile</h1>
              <p>A little about you. A clear view of your account.</p>
            </div>
          </div>
          <div className="profile-grid">
            <section
              className="profile-identity"
              aria-label="Cadet account details"
            >
              <div className="profile-monogram">
                <CadetAvatar user={user} src={avatarUrl} />
              </div>
              <div className="profile-photo-actions">
                <input
                  className="avatar-file-input"
                  ref={photoInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Choose profile photo"
                  disabled={busy || photoBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) changePhoto(file);
                  }}
                />
                <button
                  className="reload-btn"
                  type="button"
                  disabled={busy || photoBusy}
                  onClick={() => photoInput.current?.click()}
                >
                  <Camera size={15} />
                  {photoBusy
                    ? "Saving photo…"
                    : user.user_metadata?.avatar_path
                      ? "Change photo"
                      : "Upload photo"}
                </button>
                {user.user_metadata?.avatar_path && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busy || photoBusy}
                    onClick={() => changePhoto(null)}
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <p className="profile-photo-hint">
                JPG, PNG, or WebP · Up to 2 MB
                <br />
                Photos are cropped to a square.
              </p>
              {photoError && (
                <div className="alert alert-error" role="alert">
                  {photoError}
                </div>
              )}
              {photoNotice && (
                <div className="alert alert-success" role="status">
                  {photoNotice}
                </div>
              )}
              <span className="d-eyebrow">PREPARING WITH PURPOSE</span>
              <h2>{name}</h2>
              <p className="profile-email">{user.email}</p>
              <span className="profile-badge">
                <ShieldCheck size={15} />
                Cadet account
              </span>
              <dl className="profile-facts">
                <div>
                  <dt>
                    <CalendarDays size={15} />
                    Joined
                  </dt>
                  <dd>{joined}</dd>
                </div>
                <div>
                  <dt>
                    <Mail size={15} />
                    Email status
                  </dt>
                  <dd>
                    {user.email_confirmed_at ? "Verified" : "Not verified"}
                  </dd>
                </div>
              </dl>
            </section>
            <div className="profile-card profile-panels">
              <section aria-labelledby="personal-details-title">
                <div className="profile-section-heading">
                  <span className="profile-section-icon">
                    <UserRound size={20} />
                  </span>
                  <div>
                    <h2 id="personal-details-title">Personal details</h2>
                    <p>
                      Keep your name up to date for your preparation journey.
                    </p>
                  </div>
                </div>
                {error && (
                  <div className="alert alert-error" role="alert">
                    {error}
                  </div>
                )}
                {notice && (
                  <div className="alert alert-success" role="status">
                    <CheckCircle2 size={17} />
                    {notice}
                  </div>
                )}
                <form className="auth-form" onSubmit={save}>
                  <label className="field-label">
                    Full name
                    <div className="input-wrap">
                      <UserRound size={18} />
                      <input
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={80}
                        value={fullName}
                        disabled={busy || photoBusy}
                        onChange={(event) => {
                          setFullName(event.target.value);
                          setNotice("");
                          setError("");
                        }}
                      />
                    </div>
                  </label>
                  <label className="field-label">
                    Email address
                    <div className="input-wrap profile-readonly">
                      <Mail size={18} />
                      <input
                        type="email"
                        autoComplete="email"
                        value={user.email || ""}
                        readOnly
                        aria-describedby="profile-email-hint"
                      />
                    </div>
                  </label>
                  <p className="profile-hint" id="profile-email-hint">
                    This is the email address linked to your login.
                  </p>
                  <section
                    className="profile-security"
                    aria-labelledby="security-title"
                  >
                    <span className="profile-section-icon">
                      <LockKeyhole size={20} />
                    </span>
                    <div>
                      <h2 id="security-title">Account security</h2>
                      <p>Keep your account protected with a strong password.</p>
                    </div>
                    <Link className="reload-btn" to="/reset-password">
                      Change password
                      <ArrowRight size={15} />
                    </Link>
                  </section>
                  <div className="profile-form-actions">
                    <button
                      className="btn btn-dark"
                      type="submit"
                      disabled={
                        busy || photoBusy || fullName.trim() === savedName
                      }
                      aria-busy={busy}
                    >
                      <Save size={16} />
                      {busy ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
