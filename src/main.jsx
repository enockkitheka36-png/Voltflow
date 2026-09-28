import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { VoltflowPlatformProvider } from './platform/PlatformContext.jsx'
import { SecureApplicationBoundary } from './platform/RestrictedPortal.jsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <VoltflowPlatformProvider>
        <SecureApplicationBoundary>
          <App />
        </SecureApplicationBoundary>
      </VoltflowPlatformProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
)
