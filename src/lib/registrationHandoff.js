// One-use, in-memory handoff. Passwords never enter URL/history/browser storage.
let pending = null;
export function setRegistrationHandoff(email, password) { pending = { email, password }; }
export function takeRegistrationHandoff() { const value = pending; pending = null; return value; }
