import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type FileInfo } from '@/api/client'
import { trashItemToFileInfo } from '@/lib/utils'

/** The synthetic path that means "we're viewing the trash, not a folder". */
export const TRASH_VIEW_PATH = '/.deleted_items'

/**
 * Owns trash-view state: whether we're in the trash, the trash listing, and
 * the sidebar badge count. Conversion from manifest entries to FileInfo rows
 * lives here so the page component doesn't need to know the shape.
 */
export function useTrashMode(currentPath: string) {
  const isTrashView = currentPath === TRASH_VIEW_PATH

  // Sidebar badge — always fetched regardless of view.
  const { data: trashInfo } = useQuery({
    queryKey: ['trash-info'],
    queryFn: () => api.getTrashInfo(),
    staleTime: 30000,
  })

  // Full listing — only fetched when the user is actually in the trash view.
  const { data: trashListing, isLoading: isLoadingTrash } = useQuery({
    queryKey: ['trash-list'],
    queryFn: () => api.listTrash(),
    enabled: isTrashView,
  })

  const trashFiles: FileInfo[] = useMemo(() => {
    if (!trashListing?.items) return []
    return trashListing.items.map(trashItemToFileInfo)
  }, [trashListing])

  return {
    isTrashView,
    trashFiles,
    isLoadingTrash,
    trashInfo,
  }
}
