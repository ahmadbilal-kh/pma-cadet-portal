import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import './interview-calendar.css';

export const localDateValue = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const parse = value => { const [year,month,day] = value.split('-').map(Number); return new Date(year,month-1,day,12); };
export default function InterviewCalendar({ value, onChange }) {
  const selected = parse(value);
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
  const today = localDateValue();
  const start = (month.getDay()+6)%7;
  const days = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
  const priorDisabled = month.getFullYear() < new Date().getFullYear() || (month.getFullYear() === new Date().getFullYear() && month.getMonth() <= new Date().getMonth());
  return <fieldset className="interview-calendar"><legend>Interview date</legend><input className="history-visually-hidden" type="date" aria-label="Interview date" value={value} min={today} onChange={event => { if (event.target.value >= today) { onChange(event.target.value); const date = parse(event.target.value); setMonth(new Date(date.getFullYear(),date.getMonth(),1,12)); } }} tabIndex={-1} />
    <div className="calendar-header"><span><CalendarDays size={19} /><strong aria-live="polite">{month.toLocaleDateString('en-PK',{month:'long',year:'numeric'})}</strong></span><div><button type="button" aria-label="Previous month" disabled={priorDisabled} onClick={() => setMonth(date => new Date(date.getFullYear(),date.getMonth()-1,1,12))}><ChevronLeft size={17} /></button><button type="button" aria-label="Next month" onClick={() => setMonth(date => new Date(date.getFullYear(),date.getMonth()+1,1,12))}><ChevronRight size={17} /></button></div></div>
    <div className="calendar-weekdays" aria-hidden="true">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <span key={day}>{day}</span>)}</div>
    <div className="calendar-days" role="group" aria-label="Choose interview date">{Array.from({length:start},(_,i)=><span key={`empty-${i}`} />)}{Array.from({length:days},(_,i)=> {
      const date = new Date(month.getFullYear(),month.getMonth(),i+1,12), key = localDateValue(date);
      return <button key={key} type="button" disabled={key < today} aria-pressed={value===key} aria-current={key===today ? 'date' : undefined} aria-label={date.toLocaleDateString('en-PK',{day:'numeric',month:'long',year:'numeric'})} onClick={() => onChange(key)}>{i+1}</button>;
    })}</div><div className="calendar-footer"><span>{selected.toLocaleDateString('en-PK',{weekday:'short',day:'numeric',month:'short'})}</span><button type="button" onClick={() => { onChange(today); const now = new Date(); setMonth(new Date(now.getFullYear(),now.getMonth(),1,12)); }}>Today</button></div>
  </fieldset>;
}
