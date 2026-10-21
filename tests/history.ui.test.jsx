import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '../src/AppRoutes';
import { readLocalHistory, recordResult } from '../src/lib/testHistory';

const auth = vi.hoisted(() => ({ user: { id: 'u1' }, loading: false, configured: true, refreshUser: vi.fn() }));
const service = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../src/lib/testHistory', async importOriginal => ({ ...await importOriginal(), loadHistory: service.load }));
function open(path = '/progress') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppRoutes /></MemoryRouter>);
}
const make = (id, category, correct, days = 0) => ({ id, category, correct, incorrect: 85 - correct, unanswered: 0, reason: 'complete', finished: Date.now() - days * 86400000, duration: 60000, pass: correct >= 64, synced: true });
beforeEach(() => {
  localStorage.clear(); window.scrollTo = vi.fn();
  auth.user = { id: 'u1', email: 'cadet@example.test', user_metadata: { full_name: 'Ahmad Bilal' } };
  auth.refreshUser.mockReset().mockResolvedValue(undefined);
  service.load.mockReset().mockResolvedValue({ rows: [], offline: false });
});
afterEach(cleanup);
async function loaded() { await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh history' }).disabled).toBe(false)); }
function tableRows() { return within(screen.getByRole('table')).getAllByRole('row').slice(1); }

test('the dashboard links to protected history and an empty account has no fabricated chart data', async () => {
  open('/dashboard');
  await userEvent.click(screen.getByRole('link', { name: 'History & Progress', exact: true }));
  expect(await screen.findByRole('heading', { name: 'History & Progress' })).toBeTruthy();
  await loaded();
  expect(screen.getByRole('heading', { name: 'Start your first test' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Start your first test' })).toBeTruthy();
  const dialog = screen.getByRole('dialog', { name: "Let's start the test" });
  expect(within(dialog).getAllByRole('link')).toHaveLength(3);
  expect(screen.queryByLabelText('Training area')).toBeNull();
  expect(screen.queryByRole('region', { name: 'Progress summary' })).toBeNull();
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.queryByRole('img', { name: /Score trend/ })).toBeNull();
  expect(service.load).toHaveBeenCalledWith(expect.anything(), 'u1');
});

test('charts, summary, and history table reflect category, result, and period filters', async () => {
  service.load.mockResolvedValue({ rows: [make('v1', 'verbal', 45), make('v2', 'verbal', 70, 1), make('n1', 'nonverbal', 80, 2), make('a1', 'academic', 60, 90)], offline: false });
  open(); await loaded();
  expect(screen.queryByRole('dialog')).toBeNull();
  const summary = within(screen.getByRole('region', { name: 'Progress summary' }));
  expect(summary.getByText('75%')).toBeTruthy();
  expect(summary.getByText('80/85')).toBeTruthy();
  expect(summary.getByText('50%')).toBeTruthy();
  expect(tableRows()).toHaveLength(4);
  expect(screen.queryByText(/Pass mark:/)).toBeNull();
  const first = screen.getByRole('button', { name: /Attempt 1: Academic Preparation, 60 of 85/ });
  await userEvent.click(first);
  expect(first.getAttribute('aria-pressed')).toBe('true');
  await userEvent.selectOptions(screen.getByLabelText('Training area'), 'verbal');
  expect(tableRows()).toHaveLength(2);
  expect(summary.getByText('68%')).toBeTruthy();
  await userEvent.selectOptions(screen.getByLabelText('Result', { exact: true }), 'passed');
  expect(tableRows()).toHaveLength(1);
  expect(within(tableRows()[0]).getByText('70/85')).toBeTruthy();
  await userEvent.selectOptions(screen.getByLabelText('Training area'), 'all');
  await userEvent.selectOptions(screen.getByLabelText('Result', { exact: true }), 'all');
  await userEvent.selectOptions(screen.getByLabelText('Period'), '7');
  expect(tableRows()).toHaveLength(3);
});

test('device history remains visible after an account failure and refresh can recover', async () => {
  recordResult('u1', make('local', 'verbal', 60));
  recordResult('other-user', make('other', 'academic', 85));
  service.load.mockResolvedValueOnce({ rows: readLocalHistory('u1'), offline: true });
  open(); await loaded();
  expect(screen.queryByText(/Account history could not be loaded/)).toBeNull();
  expect(screen.getByText('Saved on this device')).toBeTruthy();
  expect(tableRows()).toHaveLength(1);
  service.load.mockResolvedValueOnce({ rows: [make('local', 'verbal', 60)], offline: false });
  await userEvent.click(screen.getByRole('button', { name: 'Refresh history' }));
  await loaded();
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByText('Saved on this device')).toBeNull();
});

test('history pagination works and changing a filter returns to the first page', async () => {
  service.load.mockResolvedValue({ rows: Array.from({ length: 10 }, (_, i) => make(String(i), i < 9 ? 'verbal' : 'academic', 70, i)), offline: false });
  open(); await loaded();
  expect(tableRows()).toHaveLength(8);
  await userEvent.click(screen.getByRole('button', { name: 'Next', exact: true }));
  expect(tableRows()).toHaveLength(2);
  expect(screen.getByText('Page 2 of 2')).toBeTruthy();
  await userEvent.selectOptions(screen.getByLabelText('Training area'), 'verbal');
  expect(screen.getByText('Page 1 of 2')).toBeTruthy();
  expect(tableRows()).toHaveLength(8);
  await userEvent.selectOptions(screen.getByLabelText('Training area'), 'nonverbal');
  expect(screen.getByText('No tests match these filters.')).toBeTruthy();
});

test('signed-out visitors cannot access account history', async () => {
  auth.user = null;
  open();
  expect(await screen.findByRole('heading', { name: 'Welcome back, cadet.' })).toBeTruthy();
  expect(service.load).not.toHaveBeenCalled();
});

test('an empty account-read failure shows the first-test invitation without warnings or zero-score charts', async () => {
  service.load.mockResolvedValue({ rows: [], offline: true });
  open(); await loaded();
  expect(screen.getByRole('heading', { name: 'Start your first test' })).toBeTruthy();
  expect(screen.queryByText(/Account history could not be loaded/)).toBeNull();
  expect(screen.queryByRole('region', { name: 'Progress summary' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Your score trend' })).toBeNull();
  expect(screen.queryByRole('table')).toBeNull();
  const dialog = screen.getByRole('dialog', { name: "Let's start the test" });
  expect(within(dialog).getByRole('link', { name: /^Academic Preparation/ }).getAttribute('href')).toBe('/test/academic');
});

test.each([
  ['Verbal Intelligence', 'verbal'],
  ['Non-Verbal Intelligence', 'nonverbal'],
  ['Academic Preparation', 'academic'],
])('the first-test popup opens the %s instructions', async (title, category) => {
  open(); await loaded();
  const dialog = screen.getByRole('dialog', { name: "Let's start the test" });
  const link = within(dialog).getByRole('link', { name: new RegExp(`^${title}`) });
  expect(link.getAttribute('href')).toBe(`/test/${category}`);
  await userEvent.click(link);
  expect(await screen.findByRole('heading', { name: title }, { timeout: 5000 })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Start 30-minute test/ })).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('the test-selection popup supports keyboard closing and can be reopened', async () => {
  open(); await loaded();
  expect(document.body.style.overflow).toBe('hidden');
  const dialog = screen.getByRole('dialog', { name: "Let's start the test" });
  expect(dialog.contains(document.activeElement)).toBe(true);
  within(dialog).getAllByRole('link').at(-1).focus();
  await userEvent.tab();
  expect(screen.getByRole('button', { name: 'Close test selection' })).toBe(document.activeElement);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.overflow).not.toBe('hidden');
  await userEvent.click(screen.getByRole('button', { name: 'Start your first test' }));
  expect(screen.getByRole('dialog', { name: "Let's start the test" })).toBeTruthy();
});

test('the invitation waits for account history before deciding whether a cadet has taken tests', async () => {
  let resolve;
  service.load.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  open();
  expect(screen.queryByRole('dialog')).toBeNull();
  await act(async () => { resolve({ rows: [make('existing', 'verbal', 70)], offline: false }); });
  await loaded();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(tableRows()).toHaveLength(1);
});
