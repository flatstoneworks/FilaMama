import { useCallback, useEffect, useRef } from 'react'

interface SelectableFile {
  path: string
}

interface UseLongPressSelectionOptions<T extends SelectableFile> {
  selectedFiles: Set<string>
  selectionMode?: boolean
  onSelect: (file: T, e?: React.MouseEvent) => void
  delayMs?: number
  moveTolerancePx?: number
}

export function useLongPressSelection<T extends SelectableFile>({
  selectedFiles,
  selectionMode = false,
  onSelect,
  delayMs = 450,
  moveTolerancePx = 10,
}: UseLongPressSelectionOptions<T>) {
  const longPressTimerRef = useRef<number | null>(null)
  const suppressClickTimerRef = useRef<number | null>(null)
  const longPressedPathRef = useRef<string | null>(null)
  const lastPointerTypeRef = useRef<string | null>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const clearSuppressedClick = useCallback(() => {
    if (suppressClickTimerRef.current) {
      window.clearTimeout(suppressClickTimerRef.current)
      suppressClickTimerRef.current = null
    }
    longPressedPathRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      clearLongPress()
      clearSuppressedClick()
    }
  }, [clearLongPress, clearSuppressedClick])

  const handlePointerDown = useCallback((file: T, event: React.PointerEvent) => {
    lastPointerTypeRef.current = event.pointerType
    pointerStartRef.current = { x: event.clientX, y: event.clientY }

    if (event.pointerType === 'mouse' || selectionMode || selectedFiles.size > 0) return

    clearLongPress()
    clearSuppressedClick()
    longPressTimerRef.current = window.setTimeout(() => {
      longPressedPathRef.current = file.path
      suppressClickTimerRef.current = window.setTimeout(clearSuppressedClick, 1000)
      onSelect(file)
    }, delayMs)
  }, [clearLongPress, clearSuppressedClick, delayMs, onSelect, selectedFiles.size, selectionMode])

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!pointerStartRef.current) return

    const deltaX = event.clientX - pointerStartRef.current.x
    const deltaY = event.clientY - pointerStartRef.current.y
    const distance = Math.hypot(deltaX, deltaY)

    if (distance > moveTolerancePx) {
      clearLongPress()
    }
  }, [clearLongPress, moveTolerancePx])

  const handlePointerEnd = useCallback(() => {
    clearLongPress()
    pointerStartRef.current = null
  }, [clearLongPress])

  const toggleSelection = useCallback((file: T, event: React.MouseEvent) => {
    onSelect(file, {
      ...event,
      ctrlKey: true,
      metaKey: true,
    } as React.MouseEvent)
  }, [onSelect])

  const handleClick = useCallback((file: T, event: React.MouseEvent, onOpen: (file: T) => void) => {
    if (longPressedPathRef.current === file.path) {
      clearSuppressedClick()
      return
    }

    const shouldToggleTouchSelection = selectedFiles.size > 0 && lastPointerTypeRef.current !== 'mouse'
    if (selectionMode || shouldToggleTouchSelection) {
      toggleSelection(file, event)
      return
    }

    onOpen(file)
  }, [clearSuppressedClick, selectedFiles.size, selectionMode, toggleSelection])

  return {
    handleClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
  }
}
