import { Clock3, Sun, Moon } from 'lucide-react';
import './interview-time.css';

export default function InterviewTimePicker({ value = '10:00', onChange }) {
  const [hour, minute] = value.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  function update(nextHour, nextMinute, nextPeriod) {
    const fullHour = nextHour % 12 + (nextPeriod === 'PM' ? 12 : 0);
    onChange(`${String(fullHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`);
  }
  return <fieldset className="interview-time"><legend>Interview time</legend><div className="interview-time-picker"><div className="interview-time-controls"><span className="interview-time-caption"><Clock3 size={13} />CHOOSE YOUR TIME</span><div className="time-select-row"><label><span className="history-visually-hidden">Interview hour</span><select value={displayHour} onChange={event => update(Number(event.target.value), minute, period)}>{Array.from({ length: 12 }, (_, index) => <option value={index + 1} key={index}>{String(index + 1).padStart(2, '0')}</option>)}</select></label><b aria-hidden="true">:</b><label><span className="history-visually-hidden">Interview minute</span><select value={minute} onChange={event => update(displayHour, Number(event.target.value), period)}>{Array.from({ length: 60 }, (_, minute) => <option value={minute} key={minute}>{String(minute).padStart(2, '0')}</option>)}</select></label><div className="time-period" role="group" aria-label="Time of day">{['AM','PM'].map(option => <button key={option} type="button" aria-pressed={period === option} onClick={() => update(displayHour, minute, option)}>{option === 'AM' ? <Sun size={12} /> : <Moon size={12} />}{option}</button>)}</div></div><output aria-label="Selected interview time">{String(displayHour).padStart(2,'0')}:{String(minute).padStart(2,'0')} {period}</output></div></div></fieldset>;
}
