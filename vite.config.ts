import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This makes the environment variable available on the client-side
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  base: './', // Ubah dari '/' ke './' agar aset dimuat relative (wajib untuk Capacitor/Android)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
