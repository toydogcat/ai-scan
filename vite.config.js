import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: '/ai-scan/',
  plugins: process.env.HTTPS ? [basicSsl()] : [],
});
