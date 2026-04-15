import { useEffect, useMemo, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type FileInfo } from '@/api/client'
import { useDebounce } from './useDebounce'
import {
  searchResultToFileInfo,
  contentSearchResultToFileInfo,
} from '@/lib/utils'

/** Page size used for the recursive filename search. Grows when the user
 *  clicks "Load more". */
const INITIAL_SEARCH_LIMIT = 500
const SEARCH_LIMIT_STEP = 500

interface UseFileSearchArgs {
  currentPath: string
  searchQuery: string
  activeContentType: string | null
  contentSearchMode: boolean
}

/**
 * Owns everything related to searching — both recursive filename search and
 * ripgrep-backed content search. Debounces the query, runs the appropriate
 * TanStack queries, and produces `FileInfo[]` ready to render.
 */
export function useFileSearch({
  currentPath,
  searchQuery,
  activeContentType,
  contentSearchMode,
}: UseFileSearchArgs) {
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Grows when user clicks "Load more"; resets when the search changes.
  const [searchLimit, setSearchLimit] = useState(INITIAL_SEARCH_LIMIT)
  useEffect(() => {
    setSearchLimit(INITIAL_SEARCH_LIMIT)
  }, [debouncedSearchQuery, activeContentType, currentPath])

  const loadMoreResults = useCallback(() => {
    setSearchLimit((prev) => prev + SEARCH_LIMIT_STEP)
  }, [])

  // UI mode flags — based on the un-debounced query so the header updates immediately.
  const isFilenameSearchActive = (!!searchQuery || !!activeContentType) && !contentSearchMode
  const isContentSearchActive = !!searchQuery && contentSearchMode && searchQuery.length >= 2
  const isSearchActive = isFilenameSearchActive || isContentSearchActive

  // Query enablement flags — based on the debounced query.
  const isFilenameSearchReady = (!!debouncedSearchQuery || !!activeContentType) && !contentSearchMode
  const isContentSearchReady = !!debouncedSearchQuery && contentSearchMode && debouncedSearchQuery.length >= 2

  // Recursive filename search
  const {
    data: searchResponse,
    isLoading: isSearching,
    isFetching: isSearchFetching,
  } = useQuery({
    queryKey: ['recursive-search', debouncedSearchQuery, activeContentType, currentPath, searchLimit],
    queryFn: () =>
      api.searchFiles({
        query: debouncedSearchQuery || undefined,
        contentType: activeContentType || undefined,
        path: currentPath,
        maxResults: searchLimit,
      }),
    enabled: isFilenameSearchReady,
    placeholderData: (prev) => prev,
  })

  // Content search (ripgrep-backed)
  const {
    data: contentSearchResponse,
    isLoading: isContentSearching,
  } = useQuery({
    queryKey: ['content-search', debouncedSearchQuery, currentPath],
    queryFn: () =>
      api.searchContent({
        query: debouncedSearchQuery,
        path: currentPath,
        maxFiles: 100,
        maxDepth: 3,
      }),
    enabled: isContentSearchReady,
  })

  const searchResults = searchResponse?.results
  const searchHasMore = searchResponse?.has_more ?? false
  const searchTotalScanned = searchResponse?.total_scanned ?? 0

  const contentSearchResults = contentSearchResponse?.results
  const contentSearchFilesSearched = contentSearchResponse?.files_searched ?? 0
  const contentSearchFilesWithMatches = contentSearchResponse?.files_with_matches ?? 0
  const contentSearchHasMore = contentSearchResponse?.has_more ?? false

  const filenameResultsAsFiles: FileInfo[] = useMemo(() => {
    if (!searchResults) return []
    return searchResults.map(searchResultToFileInfo)
  }, [searchResults])

  const contentResultsAsFiles = useMemo(() => {
    if (!contentSearchResults) return []
    return contentSearchResults.map(contentSearchResultToFileInfo)
  }, [contentSearchResults])

  return {
    // Mode flags
    isFilenameSearchActive,
    isContentSearchActive,
    isSearchActive,

    // Results
    filenameResultsAsFiles,
    contentResultsAsFiles,

    // Query state
    debouncedSearchQuery,
    isSearching,
    isSearchFetching,
    isContentSearching,

    // Filename-search metadata
    searchResultsCount: searchResults?.length ?? 0,
    searchHasMore,
    searchTotalScanned,

    // Content-search metadata
    contentSearchFilesSearched,
    contentSearchFilesWithMatches,
    contentSearchHasMore,

    // Pagination
    loadMoreResults,
  }
}
