import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/Layout'
import { FilesPage } from '@/pages/FilesPage'
import { PreviewPage } from '@/pages/PreviewPage'
import { AudioPlayerProvider, useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { MiniPlayer } from '@/components/MiniPlayer'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5000, refetchOnWindowFocus: false } },
})

// Global audio player that persists across all routes
function GlobalAudioPlayer() {
  const { playlist, currentIndex, isOpen, setCurrentIndex, close } = useAudioPlayer()

  if (!isOpen || playlist.length === 0) return null

  return (
    <MiniPlayer
      playlist={playlist}
      currentIndex={currentIndex}
      onIndexChange={setCurrentIndex}
      onClose={close}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AudioPlayerProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/browse" replace />} />
              <Route path="browse/*" element={<FilesPage />} />
            </Route>
            <Route path="view/*" element={<PreviewPage />} />
          </Routes>
          <Toaster />
          <GlobalAudioPlayer />
        </BrowserRouter>
      </AudioPlayerProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
