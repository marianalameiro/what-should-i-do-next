import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import TrayApp from './components/TrayApp.jsx'
import './App.css'

const isTray = window.location.hash.includes('#/tray')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isTray ? <TrayApp /> : <App />}
  </StrictMode>,
)