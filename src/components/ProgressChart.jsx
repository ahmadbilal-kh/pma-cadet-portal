import { useState } from 'react';
import { categories, TOTAL } from '../exam/engine';

export default function ProgressChart({ rows }) {
  const points = rows.slice(0, 12).reverse();
  const [selectedId, setSelectedId] = useState(null);
  const selected = points.find(row => row.id === selectedId) || points.at(-1);
  if (!points.length) return <div className="history-chart-empty">Your progress chart will appear after your first completed test.</div>;
  const x = index => points.length === 1 ? 330 : 50 + index * 560 / (points.length - 1);
  const y = score => 190 - score / TOTAL * 160;
  const line = points.map((row, index) => `${index ? 'L' : 'M'}${x(index)},${y(row.correct)}`).join(' ');
  const date = value => new Intl.DateTimeFormat('en-PK', { day: 'numeric', month: 'short' }).format(new Date(value));

  return <>
    <svg className="history-chart" viewBox="0 0 660 230" role="img" aria-label="Score trend for the latest completed attempts. Select an attempt below to see its score.">
      {[0, 25, 50, 75, 100].map(percent => <g key={percent}><line x1="50" x2="610" y1={190 - percent * 1.6} y2={190 - percent * 1.6} className="history-gridline" /><text x="39" y={194 - percent * 1.6} textAnchor="end">{percent}%</text></g>)}
      <path d={`${line} L${x(points.length - 1)},190 L${x(0)},190 Z`} className="history-chart-area" />
      <path d={line} className="history-chart-line" />
      {points.map((row, index) => <circle key={row.id} cx={x(index)} cy={y(row.correct)} r={row.id === selected.id ? 6 : 4} className={row.id === selected.id ? 'history-dot selected' : 'history-dot'} onClick={() => setSelectedId(row.id)}><title>{`${date(row.finished)}: ${row.correct}/${TOTAL}`}</title></circle>)}
      <text x="50" y="218">{date(points[0].finished)}</text><text x="610" y="218" textAnchor="end">{points.length > 1 ? date(points.at(-1).finished) : ''}</text>
    </svg>
    <div className="history-point-controls" aria-label="Select chart attempt">{points.map((row, index) => <button type="button" key={row.id} aria-label={`Attempt ${index + 1}: ${categories[row.category]}, ${row.correct} of ${TOTAL}`} aria-pressed={selected.id === row.id} onClick={() => setSelectedId(row.id)}>{index + 1}</button>)}</div>
    <p className="history-chart-selection" aria-live="polite">{date(selected.finished)} · {categories[selected.category]} <strong>{selected.correct}/{TOTAL} ({Math.round(selected.correct / TOTAL * 100)}%)</strong></p>
  </>;
}
