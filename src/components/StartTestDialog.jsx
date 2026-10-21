import { useEffect, useRef } from 'react';
import { ArrowRight, BookOpen, BrainCircuit, Eye, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const choices = [
  { category: 'verbal', title: 'Verbal Intelligence', description: 'Words, numbers, and logical reasoning.', icon: BrainCircuit },
  { category: 'nonverbal', title: 'Non-Verbal Intelligence', description: 'Visual patterns, shapes, and spatial skills.', icon: Eye },
  { category: 'academic', title: 'Academic Preparation', description: 'Mathematics, English, science, and more.', icon: BookOpen },
];

export default function StartTestDialog({ onClose }) {
  const panel = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current.querySelector('a')?.focus();
    function keyboard(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const items = panel.current.querySelectorAll('a[href],button:not([disabled])');
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keyboard);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  return <div className="exam-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="start-test-dialog" ref={panel} role="dialog" aria-modal="true" aria-labelledby="start-test-title" aria-describedby="start-test-description">
      <button className="start-test-close" type="button" aria-label="Close test selection" onClick={onClose}><X size={20} /></button>
      <span className="d-eyebrow">YOUR NEXT STEP STARTS HERE</span>
      <h2 id="start-test-title">Let's start the test</h2>
      <p id="start-test-description">Choose a training area to open its instructions and begin your first practice test.</p>
      <div className="start-test-choices">{choices.map(({ category, title, description, icon: Icon }) => <Link key={category} className={`start-test-choice ${category}`} to={`/test/${category}`}>
        <span className="start-test-choice-icon"><Icon size={23} /></span><span><strong>{title}</strong><small>{description}</small></span><ArrowRight size={18} />
      </Link>)}</div>
      <p className="start-test-footnote">Your progress will appear here after you complete a test.</p>
    </section>
  </div>;
}
