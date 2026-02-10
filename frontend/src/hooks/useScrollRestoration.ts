import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Hook to save and restore scroll position when navigating between pages.
 * Uses sessionStorage to persist scroll positions.
 *
 * @param scrollRef - ref to the scrollable element
 * @param isReady - whether content has loaded and scroll can be restored
 */
export function useScrollRestoration(
  scrollRef: React.RefObject<HTMLElement | null>,
  isReady = true,
) {
  const location = useLocation()
  const lastLocationKey = useRef<string>('')
  const pendingRestore = useRef<string | null>(null)

  // Save scroll position when navigating away
  useEffect(() => {
    return () => {
      if (scrollRef.current && lastLocationKey.current) {
        const scrollTop = scrollRef.current.scrollTop
        sessionStorage.setItem(`scroll-${lastLocationKey.current}`, scrollTop.toString())
      }
    }
  }, [scrollRef])

  // Track location changes and queue scroll restoration
  useEffect(() => {
    const key = `${location.pathname}${location.search}`

    if (key !== lastLocationKey.current) {
      lastLocationKey.current = key

      const savedPosition = sessionStorage.getItem(`scroll-${key}`)
      if (savedPosition) {
        pendingRestore.current = savedPosition
      } else {
        pendingRestore.current = null
      }
    }
  }, [location])

  // Restore scroll position once content is ready
  useEffect(() => {
    if (!isReady || !pendingRestore.current || !scrollRef.current) return

    const position = parseInt(pendingRestore.current, 10)
    pendingRestore.current = null

    // Use double RAF to ensure layout is complete after React render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = position
        }
      })
    })
  }, [isReady, scrollRef])

  // Save scroll position on scroll (debounced)
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    let timeoutId: number
    const handleScroll = () => {
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
