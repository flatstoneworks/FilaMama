// JSX augmentations for non-standard HTML attributes used by FilaMama.

import 'react'

declare module '*.css'

declare module 'react' {
  interface InputHTMLAttributes<T> {
    // Chromium-specific attribute that lets <input type="file"> pick a folder.
    // Not part of the HTML spec, so React's types omit it.
    webkitdirectory?: string
  }
}
