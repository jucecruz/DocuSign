'use client'

import { useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { Upload, FileText, X, Hash } from 'lucide-react'

interface FileUploaderProps {
  onHashReady: (hash: string, file: File) => void
}

export function FileUploader({ onHashReady }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

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
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const clear = () => {
    setSelectedFile(null)
    setHash(null)
    setError(null)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      {/* Zona de drop */}
      {!selectedFile && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ${
            dragging
              ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 scale-[1.01]'
              : 'border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10'
          }`}
        >
          <input
            type="file"
            id="file-input"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center gap-4 pointer-events-none">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
              dragging ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-zinc-100 dark:bg-zinc-800'
            }`}>
              <Upload className={`w-6 h-6 transition-colors ${dragging ? 'text-indigo-500' : 'text-zinc-400'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {dragging ? 'Drop to compute hash' : 'Upload your document here'}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                or <span className="text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer">click to browse</span>
              </p>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-600">Any file type &middot; Hash computed locally</p>
          </div>
        </div>
      )}

      {/* Calculando... */}
      {loading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          <p className="text-sm text-indigo-600 dark:text-indigo-400">Computing Keccak256 hash…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400 px-1">{error}</p>
      )}

      {/* Archivo seleccionado */}
      {selectedFile && hash && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          {/* Info del archivo */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                <FileText className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{selectedFile.name}</p>
                <p className="text-xs text-zinc-400">{formatSize(selectedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={clear}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shrink-0 ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Hash */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Keccak256 Hash</span>
            </div>
            <p className="text-xs font-mono text-zinc-600 dark:text-zinc-300 break-all leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2">{hash}</p>
          </div>
        </div>
      )}
    </div>
  )
}
