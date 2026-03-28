import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { dataService } from './services/dataService'
import { initializeStorageAdapter } from './services/storageAdapter'

const bootstrap = async () => {
  const adapter = await initializeStorageAdapter()
  dataService.setStorageAdapter(adapter)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
