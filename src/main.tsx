import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import BootstrapApp from './BootstrapApp'
import { appQueryClient } from './query/queryClient'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={appQueryClient}>
      <BootstrapApp />
    </QueryClientProvider>
  </StrictMode>,
)
