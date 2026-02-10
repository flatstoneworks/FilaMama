import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/components/ui/use-toast'

const STORAGE_KEY = 'filamama-favorites'

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  }, [favorites])

  const addToFavorites = useCallback((path: string) => {
    setFavorites(prev => {
      if (prev.includes(path)) return prev
      return [...prev, path]
    })
    const name = path.split('/').pop() || path
    toast({ title: `Added "${name}" to favorites` })
  }, [])

  const removeFromFavorites = useCallback((path: string) => {
    setFavorites(prev => prev.filter(p => p !== path))
    const name = path.split('/').pop() || path
    toast({ title: `Removed "${name}" from favorites` })
  }, [])

  const isFavorite = useCallback((path: string) => {
    return favorites.includes(path)
  }, [favorites])

  return { favorites, addToFavorites, removeFromFavorites, isFavorite }
}
