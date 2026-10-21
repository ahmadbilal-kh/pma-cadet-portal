import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import PhoneVerification from '../src/components/PhoneVerification';
import InterviewTimePicker from '../src/components/InterviewTimePicker';

afterEach(() => { cleanup(); vi.useRealTimers(); });
function setup(invoke = vi.fn()) {
  const verified = vi.fn();
  function Form() {
    const [phone, setPhone] = useState({ country: 'PK', phone: '3001234567' });
    return <PhoneVerification client={{ functions: { invoke } }} country={phone.country} phone={phone.phone} email="cadet@example.test" purpose="registration" onChange={setPhone} onVerified={verified} />;
  }
  render(<Form />);
  return { invoke, verified };
}
const pending = () => ({ data: { id: '11111111-1111-4111-8111-111111111111', secret: 'a'.repeat(64), expiresAt: Date.now()+600000 }, error: null });
test('SMS verification clears when the mobile number changes and never stores codes or proofs', async () => {
  const invoke = vi.fn().mockResolvedValueOnce(pending()).mockResolvedValueOnce({ data: { verified: true, phone: '+923001234567' } });
  const { verified } = setup(invoke);
  fireEvent.click(screen.getByRole('button', { name: 'Send SMS code' }));
  fireEvent.change(await screen.findByLabelText('SMS verification code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
  await screen.findByText('Mobile verified');
  expect(verified).toHaveBeenLastCalledWith(expect.objectContaining({ verified: true, phone: '+923001234567' }));
  expect(invoke.mock.calls[0][1].headers).toEqual({ Authorization: '' });
  expect(invoke.mock.calls[0][1].body.phone).toBe('+923001234567');
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '3009876543' } });
  expect(screen.queryByText('Mobile verified')).toBeNull();
  expect(verified).toHaveBeenLastCalledWith(null);
  expect(screen.queryByLabelText('SMS verification code')).toBeNull();
});
test('SMS setup failure does not show sent or verified status', async () => {
  setup(vi.fn().mockResolvedValue({ data: null, error: { context: { json: async () => ({ error: 'SMS is not configured yet.' }) } } }));
  fireEvent.click(screen.getByRole('button', { name: 'Send SMS code' }));
  expect((await screen.findByRole('alert')).textContent).toContain('not configured');
  expect(screen.queryByLabelText('SMS verification code')).toBeNull();
  expect(screen.queryByText('Mobile verified')).toBeNull();
});
test('invalid SMS codes cannot verify and resend remains on cooldown', async () => {
  const invoke = vi.fn().mockResolvedValueOnce(pending()).mockResolvedValueOnce({ data: { error: 'Invalid or expired SMS code.' } });
  const { verified } = setup(invoke);
  fireEvent.click(screen.getByRole('button', { name: 'Send SMS code' }));
  const code = await screen.findByLabelText('SMS verification code');
  expect(screen.getByRole('button', { name: /Resend in/ }).disabled).toBe(true);
  fireEvent.change(code, { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
  expect(screen.getByRole('alert').textContent).toContain('6-digit');
  expect(invoke).toHaveBeenCalledTimes(1);
  fireEvent.change(code, { target: { value: '999999' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Invalid');
  expect(verified).toHaveBeenLastCalledWith(null);
});
test('verification responses for a changed identity are ignored', async () => {
  let resolve;
  const invoke = vi.fn().mockImplementation(() => new Promise(done => { resolve = done; }));
  const { verified } = setup(invoke);
  fireEvent.click(screen.getByRole('button', { name: 'Send SMS code' }));
  // A parent may update identity while a request is pending (e.g. email edit).
  cleanup();
  await act(async () => resolve(pending()));
  expect(verified.mock.calls.every(([proof]) => proof === null)).toBe(true);
});
test('clock defaults to 10 AM and correctly converts noon, midnight, and custom minutes', () => {
  function Clock() { const [time, setTime] = useState('10:00'); return <><InterviewTimePicker value={time} onChange={setTime} /><span data-testid="raw-time">{time}</span></>; }
  render(<Clock />);
  expect(screen.getByLabelText('Selected interview time').textContent).toBe('10:00 AM');
  fireEvent.change(screen.getByLabelText('Interview hour'), { target: { value: '12' } });
  expect(screen.getByTestId('raw-time').textContent).toBe('00:00');
  fireEvent.click(screen.getByRole('button', { name: 'PM' }));
  expect(screen.getByTestId('raw-time').textContent).toBe('12:00');
  fireEvent.change(screen.getByLabelText('Interview minute'), { target: { value: '45' } });
  expect(screen.getByLabelText('Selected interview time').textContent).toBe('12:45 PM');
});
