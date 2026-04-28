import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/fittraining/',
    plugins: [react()],
    server: {
        proxy: {
            '/api': 'http://localhost:8510'
        }
    }
})
