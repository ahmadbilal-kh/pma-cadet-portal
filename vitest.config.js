import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Avoid CPU contention between many browser DOMs on developer laptops.
  test: { environment: 'jsdom', include: ['tests/**/*.ui.test.jsx'], clearMocks: true, maxWorkers: 2 },
});
