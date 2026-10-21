import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ExamPage from '../src/pages/ExamPage';
import { createAttempt, finish, LIMIT } from '../src/exam/engine';

const store = vi.hoisted(() => ({ upsert: vi.fn(), from: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ supabase: { from: store.from } }));
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', user_metadata: { full_name: 'Ahmad' } } }) }));
vi.mock('../src/exam/paper', () => ({
  signature: q => q.id,
  makePaper: () => Array.from({ length: 85 }, (_, i) => ({ id: String(i), category: 'Verbal Intelligence', question: `Practice question ${i + 1}`, options: ['Alpha', 'Bravo', 'Charlie', 'Delta'], answer: 0, explanation: 'Alpha is correct.' })),
}));
const key = 'cadetprep:u1:verbal';
function open() {
  return render(<MemoryRouter initialEntries={['/test/verbal']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes><Route path="/test/:category" element={<ExamPage />} /></Routes>
  </MemoryRouter>);
}
async function start() {
  open();
  await userEvent.click(screen.getByRole('button', { name: /Start 30-minute test/ }));
}
beforeEach(() => {
  localStorage.clear();
  store.upsert.mockReset().mockResolvedValue({ error: null });
  store.from.mockReset().mockReturnValue({ upsert: store.upsert });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

test.each(['A Alpha', 'B Bravo'])('selecting %s stays neutral, locks the answer, and enables navigation', async optionName => {
  await start();
  expect(screen.getByRole('button', { name: /Next/ }).disabled).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: optionName }));
  expect(screen.getByRole('button', { name: optionName }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByText('Alpha is correct.')).toBeNull();
  expect(document.querySelector('.exam-option.correct, .exam-option.incorrect, .exam-feedback')).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
  expect(store.upsert).not.toHaveBeenCalled();
  for (const option of document.querySelectorAll('.exam-option')) expect(option.disabled).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: /Next/ }));
  expect(screen.getByRole('heading', { name: /Question 2/ })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: /Previous/ }));
  expect(document.querySelector('.exam-option').disabled).toBe(true);
  expect(JSON.parse(localStorage.getItem(key)).answers[0]).toBe(optionName === 'A Alpha' ? 0 : 1);
});

test('answering the full paper shows the congratulation message only after confirming final submission', async () => {
  await start();
  for (let i = 0; i < 85; i++) {
    fireEvent.click(document.querySelector('.exam-option'));
    if (i === 63 || i === 84) {
      expect(JSON.parse(localStorage.getItem(key)).status).toBe('running');
      expect(screen.queryByText(/Congratulations/)).toBeNull();
    }
    if (i < 84) fireEvent.click(document.querySelector('.exam-question .exam-actions .btn-dark'));
  }
  expect(store.upsert).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: /Question 85/ })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Submit test' }));
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  expect(store.upsert).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Submit result' }));
  expect(await screen.findByRole('heading', { name: 'Congratulations, Ahmad! Best of luck ahead.' })).toBeTruthy();
  expect(document.querySelector('.exam-result.passed .exam-result-message')).toBeTruthy();
  expect(document.querySelector('.exam-result .exam-stats')).toBeNull();
  expect(document.querySelector('.exam-score')).toBeNull();
  await waitFor(() => expect(store.upsert).toHaveBeenCalledWith(expect.objectContaining({ correct: 85, unanswered: 0, passed: true, reason: 'complete' }), expect.anything()));
}, 15000);

test('canceling submission continues the paper; confirming saves the result', async () => {
  await start();
  await userEvent.click(screen.getByRole('button', { name: 'B Bravo' }));
  await userEvent.click(screen.getByRole('button', { name: 'Finish test' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Keep answering' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(store.upsert).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Finish test' }));
  await userEvent.click(screen.getByRole('button', { name: 'Submit result' }));
  await waitFor(() => expect(store.upsert).toHaveBeenCalled());
  expect(store.from).toHaveBeenCalledWith('practice_attempts');
  expect(store.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', incorrect: 1, correct: 0, unanswered: 84, reason: 'early' }), { onConflict: 'id' });
  expect(document.querySelector('.exam-options')).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)).paper).toEqual([]);
  const history = JSON.parse(localStorage.getItem('cadetprep:u1:history'));
  expect(history).toHaveLength(1);
  expect(history[0]).toEqual(expect.objectContaining({ id: JSON.parse(localStorage.getItem(key)).id, incorrect: 1, unanswered: 84 }));
  expect(screen.getByRole('heading', { name: 'Best of luck for next time.' })).toBeTruthy();
  expect(document.querySelector('.exam-result.not-passed .exam-result-message')).toBeTruthy();
  expect(screen.queryByText('NOT PASSED')).toBeNull();
  expect(document.querySelector('.exam-result .exam-stats')).toBeNull();
  expect(screen.queryByText('You submitted the test early.')).toBeNull();
  expect(document.querySelector('.exam-score')).toBeNull();
});

test('switching tabs or windows keeps the current attempt running without saving a result', async () => {
  await start();
  const initial = JSON.parse(localStorage.getItem(key));
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  act(() => { window.dispatchEvent(new Event('blur')); document.dispatchEvent(new Event('visibilitychange')); });
  expect(screen.getByRole('heading', { name: /Question 1/ })).toBeTruthy();
  expect(screen.queryByText('DISQUALIFIED')).toBeNull();
  expect(store.upsert).not.toHaveBeenCalled();
  const current = JSON.parse(localStorage.getItem(key));
  expect(current.status).toBe('running');
  expect(current.id).toBe(initial.id);
  expect(current.due).toBe(initial.due);
});

test('right-side numbers jump to unanswered questions and disable answered questions', async () => {
  await start();
  const panel = screen.getByRole('complementary', { name: 'Question panel' });
  const map = within(panel).getByRole('navigation', { name: 'Question navigation' });
  expect(within(map).getAllByRole('button')).toHaveLength(85);
  await userEvent.click(within(map).getByRole('button', { name: 'Question 8', exact: true }));
  expect(screen.getByRole('heading', { name: /Question 8/ })).toBeTruthy();
  expect(within(map).getByRole('button', { name: 'Question 8', exact: true }).getAttribute('aria-current')).toBe('step');
  await userEvent.click(screen.getByRole('button', { name: 'A Alpha' }));
  expect(within(map).getByRole('button', { name: 'Question 8, answered', exact: true }).disabled).toBe(true);
  await userEvent.click(within(map).getByRole('button', { name: 'Question 1', exact: true }));
  await userEvent.click(within(map).getByRole('button', { name: 'Question 8, answered', exact: true }));
  expect(screen.getByRole('heading', { name: /Question 1/ })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(key)).answers[7]).toBe(0);
});

test('question numbers support keyboard selection', async () => {
  await start();
  const button = screen.getByRole('button', { name: 'Question 12', exact: true });
  button.focus();
  await userEvent.keyboard('{Enter}');
  expect(screen.getByRole('heading', { name: /Question 12/ })).toBeTruthy();
});

test('returning to an unfinished attempt opens a fresh start screen without saving a result', async () => {
  const paper = Array.from({ length: 85 }, (_, i) => ({ id: String(i), answer: 0 }));
  const saved = createAttempt(paper, 'verbal');
  saved.answers[0] = 0;
  localStorage.setItem(key, JSON.stringify(saved));
  localStorage.setItem(`${key}:seen`, JSON.stringify(['previous-question']));
  open();
  expect(screen.getByRole('button', { name: /Start 30-minute test/ })).toBeTruthy();
  expect(screen.queryByText('DISQUALIFIED')).toBeNull();
  expect(localStorage.getItem(key)).toBeNull();
  expect(JSON.parse(localStorage.getItem(`${key}:seen`))).toEqual(['previous-question']);
  expect(store.upsert).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /Start 30-minute test/ }));
  expect(screen.getByRole('heading', { name: /Question 1/ })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(key)).id).not.toBe(saved.id);
});

test.each(['pagehide', 'beforeunload'])('%s abandons the attempt without creating a result for the next visit', async event => {
  const view = open();
  await userEvent.click(screen.getByRole('button', { name: /Start 30-minute test/ }));
  await userEvent.click(screen.getByRole('button', { name: 'A Alpha' }));
  const seen = localStorage.getItem(`${key}:seen`);
  act(() => { window.dispatchEvent(new Event(event)); });
  view.unmount();
  open();
  expect(screen.getByRole('button', { name: /Start 30-minute test/ })).toBeTruthy();
  expect(localStorage.getItem(key)).toBeNull();
  expect(localStorage.getItem(`${key}:seen`)).toBe(seen);
  expect(store.upsert).not.toHaveBeenCalled();
});

test.each(['interrupt', 'tab'])('previously stored %s results are hidden on the next visit', reason => {
  const saved = createAttempt(Array.from({ length: 85 }, () => ({ answer: 0 })), 'verbal');
  localStorage.setItem(key, JSON.stringify(finish(saved, reason)));
  open();
  expect(screen.getByRole('button', { name: /Start 30-minute test/ })).toBeTruthy();
  expect(screen.queryByText('DISQUALIFIED')).toBeNull();
  expect(store.upsert).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull();
});

test.each(['passed', 'complete', 'time', 'early'])('submitted %s results stay saved while the next visit opens fresh instructions', async reason => {
  const saved = createAttempt(Array.from({ length: 85 }, () => ({ answer: 0 })), 'verbal');
  saved.answers[0] = 0;
  const ended = finish(saved, reason);
  localStorage.setItem(key, JSON.stringify(ended));
  open();
  await waitFor(() => expect(store.upsert).toHaveBeenCalled());
  expect(screen.getByRole('button', { name: /Start 30-minute test/ })).toBeTruthy();
  expect(screen.queryByText('Best of luck for next time.')).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)).result.id).toBe(ended.result.id);
  expect(store.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: ended.id, reason }), expect.anything());
});

test('deadline automatically submits the UI without a user click', async () => {
  vi.useFakeTimers();
  open();
  fireEvent.click(screen.getByRole('button', { name: /Start 30-minute test/ }));
  vi.setSystemTime(Date.now() + LIMIT);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(screen.getByRole('heading', { name: 'Best of luck for next time.' })).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(key)).result.reason).toBe('time');
});

test('failed account saves keep a clean result screen and retry in the background on the next visit', async () => {
  store.upsert.mockResolvedValueOnce({ error: new Error('Offline') });
  const view = open();
  await userEvent.click(screen.getByRole('button', { name: /Start 30-minute test/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Finish test' }));
  await userEvent.click(screen.getByRole('button', { name: 'Submit result' }));
  await waitFor(() => expect(store.upsert).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('heading', { name: 'Best of luck for next time.' })).toBeTruthy();
  expect(screen.queryByText(/Pass threshold:/)).toBeNull();
  expect(screen.queryByText(/Question papers and answer keys/)).toBeNull();
  expect(screen.queryByText(/Result kept in this browser/)).toBeNull();
  expect(screen.queryByText(/Supabase table and connection/)).toBeNull();
  const resultId = JSON.parse(localStorage.getItem(key)).result.id;
  expect(screen.queryByRole('button', { name: 'Retry account save' })).toBeNull();
  view.unmount();
  open();
  await waitFor(() => expect(store.upsert).toHaveBeenCalledTimes(2));
  expect(store.upsert.mock.calls[1][0].id).toBe(resultId);
  expect(screen.queryByRole('button', { name: 'Retry account save' })).toBeNull();
});

test('unavailable browser storage prevents starting an untracked attempt', () => {
  open();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
  fireEvent.click(screen.getByRole('button', { name: /Start 30-minute test/ }));
  expect(screen.getByRole('alert').textContent).toContain('Storage unavailable');
  expect(screen.queryByRole('heading', { name: /Question 1/ })).toBeNull();
  expect(store.upsert).not.toHaveBeenCalled();
});
