'use client'

import { useState, useCallback } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import { useContract, type DocumentInfo } from '@/hooks/useContract'
import { useWallet } from '@/contexts/MetaMaskContext'

export function DocumentHistory() {
  const { isConnected } = useWallet()
  const { getDocumentCount, getDocumentHashByIndex, getDocumentInfo } = useContract()

  const [docs, setDocs] = useState<DocumentInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const count = await getDocumentCount()
      const items: DocumentInfo[] = []
      for (let i = 0; i < Number(count); i++) {
        const hash = await getDocumentHashByIndex(i)
        const info = await getDocumentInfo(hash)
        items.push(info)
      }
      setDocs(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [getDocumentCount, getDocumentHashByIndex, getDocumentInfo])

  const shortHex = (hex: string, start = 8, end = 6) =>
    `${hex.slice(0, start)}...${hex.slice(-end)}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {docs.length > 0 ? `${docs.length} document${docs.length > 1 ? 's' : ''} found` : 'Click refresh to load documents'}
        </p>
        <button
          onClick={load}
          disabled={loading || !isConnected}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {docs.length === 0 && !loading && !error && (
        <div className="flex flex-col items-center gap-3 py-12 text-zinc-400">
          <Clock className="w-8 h-8" />
          <p className="text-sm">No documents stored yet</p>
        </div>
      )}

      {docs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Hash</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Signer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {docs.map((doc, i) => (
                <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {shortHex(doc.hash)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {shortHex(doc.signer, 6, 4)}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    {new Date(Number(doc.timestamp) * 1000).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {shortHex(doc.signature)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
