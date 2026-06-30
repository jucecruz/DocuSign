'use client'

import { useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { Upload, FileText, X } from 'lucide-react'

interface FileUploaderProps {
  onHashReady: (hash: string, file: File) => void
}

export function FileUploader({ onHashReady }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFile = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const computed = ethers.keccak256(bytes)
      setSelectedFile(file)
      setHash(computed)
      onHashReady(computed, file)
    } catch {
      setError('Failed to compute file hash.')
    } finally {
      setLoading(false)
    }
  }, [onHashReady])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const clear = () => {
    setSelectedFile(null)
    setHash(null)
    setError(null)
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-500 transition-colors"
      >
        <input
          type="file"
          id="file-input"
          className="hidden"
          onChange={handleFileChange}
        />
        <label htmlFor="file-input" className="cursor-pointer flex flex-col items-center gap-3">
          <Upload className="w-8 h-8 text-zinc-400" />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Drop a file here or <span className="text-zinc-800 dark:text-zinc-200 font-medium">click to select</span>
          </span>
        </label>
      </div>

      {loading && (
        <p className="text-sm text-zinc-500 animate-pulse">Computing hash...</p>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {selectedFile && hash && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              <FileText className="w-4 h-4" />
              {selectedFile.name}
            </div>
            <button onClick={clear} className="text-zinc-400 hover:text-zinc-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            {(selectedFile.size / 1024).toFixed(1)} KB
          </p>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
            <p className="text-xs text-zinc-400 mb-1">Keccak256 Hash</p>
            <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 break-all">{hash}</p>
          </div>
        </div>
      )}
    </div>
  )
}
