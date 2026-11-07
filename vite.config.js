import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the built site work from any folder, such as the GitHub Pages project URL.
export default defineConfig({
  plugins: [react()],
  base: './',
});
