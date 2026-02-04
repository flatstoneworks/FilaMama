import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Hook to save and restore scroll position when navigating between pages.
 * Uses sessionStorage to persist scroll positions.
 */
export function useScrollRestoration(scrollRef: React.RefObject<HTMLElement | null>) {
  const location = useLocation()
  const lastLocationKey = useRef<string>('')

  // Save scroll position when navigating away
  useEffect(() => {
    const saveScrollPosition = () => {
      if (scrollRef.current && lastLocationKey.current) {
        const scrollTop = scrollRef.current.scrollTop
        sessionStorage.setItem(`scroll-${lastLocationKey.current}`, scrollTop.toString())
      }
    }

    // Save on unmount or location change
    return () => {
      saveScrollPosition()
    }
  }, [scrollRef])

  // Update last location key and restore scroll position
  useEffect(() => {
    const key = `${location.pathname}${location.search}`

    // Only restore if we're navigating to a new location (not initial mount with same key)
    if (key !== lastLocationKey.current) {
      lastLocationKey.current = key

      // Restore scroll position after a brief delay to allow content to render
      const savedPosition = sessionStorage.getItem(`scroll-${key}`)
      if (savedPosition && scrollRef.current) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = parseInt(savedPosition, 10)
            }
          })
        })
      }
    }
  }, [location, scrollRef])

  // Save scroll position on scroll
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    let timeoutId: number
    const handleScroll = () => {
      // Debounce scroll save
      clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        if (lastLocationKey.current) {
          sessionStorage.setItem(`scroll-${lastLocationKey.current}`, element.scrollTop.toString())
        }
      }, 100)
    }

    element.addEventListener('scroll', handleScroll)
    return () => {
      clearTimeout(timeoutId)
      element.removeEventListener('scroll', handleScroll)
    }
  }, [scrollRef])
}
