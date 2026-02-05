'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.error('Root error boundary:', error?.message ?? error)
    }
  }, [error])

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Something went wrong
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
        An error occurred while loading this page. You can try again or go back home.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 hover:opacity-90"
        >
          Try again
        </button>
        <a
          href="/"
          className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Go home
        </a>
      </div>
    </div>
  )
}
