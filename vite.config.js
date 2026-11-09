import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the built site work from any folder, such as the GitHub Pages project URL.
export default defineConfig({
  plugins: [react()],
  base: './',
  // Unit and component tests (npm test). They run in a fake browser (jsdom) and never touch the real database.
  // The browser tests in tests/e2e run with Playwright instead (npm run test:e2e).
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{js,jsx}'],
    setupFiles: ['tests/unit/setup.js'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/landing-alternatives/Train*.jsx', 'src/main.jsx', 'src/shared/config.js'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
});
