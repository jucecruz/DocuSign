'use client'

import { useState, useCallback } from 'react'
import { RefreshCw, Clock, FileText, Wallet, Calendar, Key } from 'lucide-react'
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

  const shortHex = (hex: string, start = 8, end = 6) => `${hex.slice(0, start)}…${hex.slice(-end)}`

  return (
    <div className="space-y-5">

      {/* Cabecera */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {docs.length > 0
              ? <>{docs.length} document{docs.length > 1 ? 's' : ''} registered</>
              : 'No documents loaded yet'
            }
          </p>
          {docs.length > 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">From the blockchain registry</p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading || !isConnected}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40 transition-colors shadow-sm shadow-indigo-600/25 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Estado vacío */}
      {docs.length === 0 && !loading && !error && (
        <div className="flex flex-col items-center gap-4 py-16 text-zinc-400 dark:text-zinc-600">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Clock className="w-7 h-7" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No documents stored yet</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">Connect a wallet and click Refresh to load</p>
          </div>
        </div>
      )}

      {/* Lista de documentos — cards en mobile, tabla en desktop */}
      {docs.length > 0 && (
        <>
          {/* TABLA — visible en sm+ */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  {[
                    { icon: <FileText className="w-3 h-3" />, label: 'Hash' },
                    { icon: <Wallet className="w-3 h-3" />, label: 'Signer' },
                    { icon: <Calendar className="w-3 h-3" />, label: 'Date' },
                    { icon: <Key className="w-3 h-3" />, label: 'Signature' },
                  ].map((col) => (
                    <th key={col.label} className="text-left px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        {col.icon} {col.label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {docs.map((doc, i) => (
                  <tr key={i} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {shortHex(doc.hash)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {shortHex(doc.signer, 6, 4)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(Number(doc.timestamp) * 1000).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500 dark:text-zinc-500">
                      {shortHex(doc.signature)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CARDS — visible en mobile */}
          <div className="sm:hidden space-y-3">
            {docs.map((doc, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Document #{i + 1}</span>
                  <span className="text-xs text-zinc-400">{new Date(Number(doc.timestamp) * 1000).toLocaleDateString()}</span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Hash</p>
                    <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 break-all">{shortHex(doc.hash, 10, 8)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Signer</p>
                    <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 break-all">{shortHex(doc.signer, 8, 6)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Signature</p>
                    <p className="text-xs font-mono text-zinc-500 dark:text-zinc-500 break-all">{shortHex(doc.signature, 10, 8)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
