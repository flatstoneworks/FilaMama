import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/Layout'
import { FilesPage } from '@/pages/FilesPage'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5000, refetchOnWindowFocus: false } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<FilesPage />} />
            <Route path="*" element={<FilesPage />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
