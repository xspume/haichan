// Note: Buffer polyfill removed - Bitcoin crypto libraries handle their own setup
// This fixes initialization errors and allows graceful fallback if crypto unavailable
import './polyfills'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
