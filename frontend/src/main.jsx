import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      {/* Global toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(10, 15, 30, 0.9)',
            color: '#fff',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          error: {
            style: {
              border: '1px solid rgba(239, 68, 68, 0.5)',
            },
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
          success: {
            style: {
              border: '1px solid rgba(16, 185, 129, 0.5)',
            },
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
