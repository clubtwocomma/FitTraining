import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import TvView from './components/TvView.jsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

const tvCode = new URLSearchParams(window.location.search).get('tv')

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            {tvCode ? <TvView code={tvCode.toUpperCase()} /> : <App />}
        </ErrorBoundary>
    </React.StrictMode>,
)
