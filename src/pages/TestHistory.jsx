import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, CheckCircle2, ClipboardList, RotateCw, Target, TrendingUp } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import DashboardSidebar from '../components/DashboardSidebar';
import ProfileLink from '../components/ProfileLink';
import ProgressChart from '../components/ProgressChart';
import StartTestDialog from '../components/StartTestDialog';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { loadHistory, readLocalHistory, summarizeHistory } from '../lib/testHistory';
import { categories, TOTAL } from '../exam/engine';

const PAGE_SIZE = 8;
const formatDate = value => new Intl.DateTimeFormat('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const duration = value => `${Math.floor(value / 60000)}m ${Math.floor(value / 1000) % 60}s`;

export default function TestHistory() {
  const { user, avatarUrl } = useAuth();
  const userId = user?.id;
  const [rows, setRows] = useState(() => readLocalHistory(userId));
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [category, setCategory] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(0);
  const [asOf, setAsOf] = useState(Date.now());
  const [inviteOpen, setInviteOpen] = useState(true);
  const closeInvite = useCallback(() => setInviteOpen(false), []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    loadHistory(supabase, userId).then(result => {
      if (!active) return;
      setRows(result.rows); setAsOf(Date.now()); setLoading(false);
    });
    return () => { active = false; };
  }, [userId, refresh]);

  const filtered = useMemo(() => rows.filter(row =>
    (category === 'all' || row.category === category) &&
    (outcome === 'all' || row.pass === (outcome === 'passed')) &&
    (period === 'all' || row.finished >= asOf - Number(period) * 86400000)
  ), [rows, category, outcome, period, asOf]);
  const stats = summarizeHistory(filtered);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const changeFilter = setter => event => { setter(event.target.value); setPage(0); };

  if (!user) return <Navigate to="/login" replace />;

  return <div className="dashboard-layout dashboard-v2">
    <DashboardSidebar />
    <div className="dashboard-body">
      <header className="dashboard-topbar profile-topbar"><Link className="back-link" to="/dashboard"><ArrowLeft size={16} />Back to home</Link><div className="topbar-account"><ProfileLink user={user} avatarUrl={avatarUrl} /></div></header>
      <main className="dashboard-content history-content">
        <div className="d-greeting"><div><span className="d-eyebrow">EVERY ATTEMPT COUNTS</span><h1>History & Progress</h1><p>See how far you have come, and choose where to focus next.</p></div><button type="button" className="reload-btn" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RotateCw size={15} />{loading ? 'Refreshing history…' : 'Refresh history'}</button></div>
        {!rows.length ? <section className="history-card history-empty history-first-test" aria-labelledby="first-test-title">
          {loading ? <><span className="spinner" aria-hidden="true" /><h2 id="first-test-title">Loading your progress…</h2><p role="status">Checking your completed tests.</p></> : <>
            <span className="history-first-test-icon"><BarChart3 size={34} /></span>
            <h2 id="first-test-title">Start your first test</h2>
            <p>Complete a practice test to unlock your progress charts and test history.</p>
            <button className="btn btn-dark" type="button" onClick={() => setInviteOpen(true)}>Start your first test<ArrowRight size={17} /></button>
          </>}
        </section> : <>
        <div className="history-filters">
          <label>Training area<select value={category} onChange={changeFilter(setCategory)}><option value="all">All training areas</option>{Object.entries(categories).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
          <label>Result<select value={outcome} onChange={changeFilter(setOutcome)}><option value="all">All results</option><option value="passed">Passed</option><option value="practice">Keep practising</option></select></label>
          <label>Period<select value={period} onChange={changeFilter(setPeriod)}><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>
        </div>
        <section className="history-stats" aria-label="Progress summary">
          {[['Completed tests', stats.total, ClipboardList], ['Average score', stats.average === null ? '—' : `${stats.average}%`, TrendingUp], ['Best score', stats.best === null ? '—' : `${stats.best}/${TOTAL}`, Target], ['Pass rate', stats.passRate === null ? '—' : `${stats.passRate}%`, CheckCircle2]].map(([label, value, Icon]) => <article key={label}><span className="history-stat-icon"><Icon size={20} /></span><div><span>{label}</span><strong>{value}</strong></div></article>)}
        </section>
        <div className="history-charts">
          <section className="history-card" aria-labelledby="score-trend-title"><div className="history-card-heading"><div><h2 id="score-trend-title">Your score trend</h2><p>Latest 12 attempts within your filters.</p></div><TrendingUp size={21} /></div><ProgressChart rows={filtered} /></section>
          <section className="history-card" aria-labelledby="category-progress-title"><div className="history-card-heading"><div><h2 id="category-progress-title">By training area</h2><p>Average scores within your filters.</p></div><BarChart3 size={21} /></div><div className="history-category-bars">{Object.entries(categories).map(([key, label]) => {
            const attempts = filtered.filter(row => row.category === key);
            const average = summarizeHistory(attempts).average;
            return <div key={key}><div className="history-bar-label"><span>{label}</span><strong>{average === null ? '—' : `${average}%`}</strong></div><div className={`history-bar ${key}`} role="meter" aria-label={`${label} average score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={average ?? 0} aria-valuetext={average === null ? 'No completed tests' : `${average}%`}><span style={{ width: `${average ?? 0}%` }} /></div><small>{attempts.length ? `${attempts.length} completed ${attempts.length === 1 ? 'test' : 'tests'}` : 'No tests yet'}</small></div>;
          })}</div></section>
        </div>
        <section className="history-card history-attempts" aria-labelledby="test-history-title">
          <div className="history-card-heading"><div><h2 id="test-history-title">Test history</h2><p>{loading ? 'Loading account history…' : `${filtered.length} completed ${filtered.length === 1 ? 'attempt' : 'attempts'}`}</p></div><ClipboardList size={21} /></div>
          {!visible.length ? <div className="history-empty"><span><BarChart3 size={30} /></span><h3>No tests match these filters.</h3><p>Choose a different training area, result, or period.</p></div> : <>
            <div className="history-table-wrap"><table><caption className="history-visually-hidden">Completed practice test attempts</caption><thead><tr><th scope="col">Training area</th><th scope="col">Completed</th><th scope="col">Score</th><th scope="col">Result</th><th scope="col">Time taken</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><th scope="row">{categories[row.category]}<small>{row.reason === 'time' ? 'Time ended' : row.reason === 'early' ? 'Submitted early' : 'Submitted'}</small></th><td>{formatDate(row.finished)}{!row.synced && <small>Saved on this device</small>}</td><td><strong>{row.correct}/{TOTAL}</strong><small>{Math.round(row.correct / TOTAL * 100)}%</small></td><td><span className={`history-outcome ${row.pass ? 'passed' : 'practice'}`}>{row.pass ? 'Passed' : 'Keep practising'}</span></td><td>{duration(row.duration)}</td></tr>)}</tbody></table></div>
            {pageCount > 1 && <nav className="history-pagination" aria-label="Test history pages"><span>Page {currentPage + 1} of {pageCount}</span><div><button type="button" className="reload-btn" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button type="button" className="reload-btn" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</button></div></nav>}
          </>}
        </section>
        </>}
      </main>
    </div>
    {inviteOpen && !loading && !rows.length && <StartTestDialog onClose={closeInvite} />}
  </div>;
}
