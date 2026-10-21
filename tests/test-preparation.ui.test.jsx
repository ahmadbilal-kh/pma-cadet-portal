import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import ExamPage from '../src/pages/ExamPage';
import { createAttempt, finish } from '../src/exam/engine';

const paper = vi.hoisted(() => Array.from({ length: 85 }, (_, i) => ({ id: String(i), question: `Practice question ${i + 1}`, category: 'Verbal Intelligence', options: ['A', 'B', 'C', 'D'], answer: 0 })));
vi.mock('../src/exam/paper', () => ({ makePaper: () => paper, signature: q => q.id }));
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: () => ({ upsert: async () => ({ error: null }) }) } }));
let navigate;
function Probe() { navigate = useNavigate(); return null; }
function open() {
  return render(<MemoryRouter initialEntries={['/test/verbal']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Probe /><Routes><Route path="/test/:category" element={<ExamPage />} /></Routes>
  </MemoryRouter>);
}
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

test('opening a test immediately shows fresh instructions without displaying the previous result', () => {
  const ended = finish(createAttempt(paper, 'verbal'), 'early');
  localStorage.setItem('cadetprep:u1:verbal', JSON.stringify(ended));
  open();
  expect(screen.queryByRole('heading', { name: 'Preparing your test' })).toBeNull();
  expect(screen.queryByRole('progressbar', { name: 'Loading instructions' })).toBeNull();
  expect(screen.queryByText('Best of luck for next time.')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Verbal Intelligence' })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem('cadetprep:u1:verbal')).result.id).toBe(ended.id);
  expect(screen.queryByRole('timer')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Start 30-minute test/ }));
  expect(screen.getByRole('timer').textContent).toBe('30:00');
  expect(screen.getByRole('heading', { name: /Question 1/ })).toBeTruthy();
});

test('reopening the same test route immediately shows instructions and abandons an unfinished paper', async () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: /Start 30-minute test/ }));
  expect(screen.getByRole('heading', { name: /Question 1/ })).toBeTruthy();
  await act(async () => { navigate('/test/verbal'); });
  expect(screen.getByRole('heading', { name: 'Verbal Intelligence' })).toBeTruthy();
  expect(screen.queryByRole('timer')).toBeNull();
  expect(localStorage.getItem('cadetprep:u1:verbal')).toBeNull();
  expect(screen.getByRole('button', { name: /Start 30-minute test/ })).toBeTruthy();
});

test('reading instructions does not start a test automatically', async () => {
  open();
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(screen.getByRole('button', { name: /Start 30-minute test/ })).toBeTruthy();
  expect(screen.queryByRole('timer')).toBeNull();
  expect(localStorage.getItem('cadetprep:u1:verbal')).toBeNull();
});
