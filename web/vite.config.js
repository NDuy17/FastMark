import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '..'),
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],

  server: {
    host: true, // hoặc '0.0.0.0'
    allowedHosts:true
  },
})