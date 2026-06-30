'use client'

import { useState } from 'react'
import { ethers } from 'ethers'
import { ShieldCheck, ShieldX, Search, User } from 'lucide-react'
import { FileUploader } from './FileUploader'
import { useContract } from '@/hooks/useContract'
import { useWallet } from '@/contexts/MetaMaskContext'

export function DocumentVerifier() {
  const { isConnected } = useWallet()
  const { isDocumentStored, getDocumentInfo } = useContract()

  const [hash, setHash] = useState<string | null>(null)
  const [signerInput, setSignerInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<'valid' | 'invalid' | 'not-found' | null>(null)
  const [docInfo, setDocInfo] = useState<{ signer: string; timestamp: bigint; signature: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleHashReady = (computed: string) => {
    setHash(computed)
    setResult(null)
    setDocInfo(null)
  }

  const verify = async () => {
    if (!hash) return
    setLoading(true)
    setError(null)
    setResult(null)
    setDocInfo(null)
    try {
      const stored = await isDocumentStored(hash)
      if (!stored) {
        setResult('not-found')
        return
      }
      const info = await getDocumentInfo(hash)
      setDocInfo({ signer: info.signer, timestamp: info.timestamp, signature: info.signature })

      const inputAddress = signerInput.trim()
      if (inputAddress && ethers.isAddress(inputAddress)) {
        setResult(info.signer.toLowerCase() === inputAddress.toLowerCase() ? 'valid' : 'invalid')
      } else {
        setResult('valid')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Paso 1: archivo */}
      <FileUploader onHashReady={handleHashReady} />

      {/* Campo opcional de firmante */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <User className="w-3.5 h-3.5 text-zinc-400" />
          Signer Address
          <span className="text-xs text-zinc-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={signerInput}
          onChange={(e) => setSignerInput(e.target.value)}
          placeholder="0x… leave empty to only check existence"
          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors font-mono"
        />
      </div>

      {/* Botón de verificación */}
      <button
        onClick={verify}
        disabled={!hash || loading || !isConnected}
        className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40 transition-colors shadow-sm shadow-indigo-600/25"
      >
        {loading
          ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Verifying…</>
          : <><Search className="w-4 h-4" /> Verify Document</>
        }
      </button>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Resultado: no encontrado */}
      {result === 'not-found' && (
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center shrink-0">
            <ShieldX className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">Not found on blockchain</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">This document has not been registered.</p>
          </div>
        </div>
      )}

      {/* Resultado: válido o inválido */}
      {(result === 'valid' || result === 'invalid') && docInfo && (
        <div className={`rounded-2xl border p-5 space-y-4 ${
          result === 'valid'
            ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/20'
            : 'border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/20'
        }`}>
          {/* Badge de resultado */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              result === 'valid'
                ? 'bg-emerald-100 dark:bg-emerald-900/40'
                : 'bg-red-100 dark:bg-red-900/40'
            }`}>
              {result === 'valid'
                ? <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                : <ShieldX className="w-5 h-5 text-red-600 dark:text-red-400" />
              }
            </div>
            <div>
              <p className={`font-semibold ${
                result === 'valid' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
              }`}>
                {result === 'valid' ? 'Document is authentic' : 'Signer mismatch'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {result === 'valid' ? 'Hash found and signer verified' : 'Hash found but signer does not match'}
              </p>
            </div>
          </div>

          {/* Detalles del registro */}
          <div className="grid gap-2 text-sm border-t border-current/10 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-24 shrink-0">Signer</span>
              <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">{docInfo.signer}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-24 shrink-0">Stored at</span>
              <span className="text-xs text-zinc-700 dark:text-zinc-300">{new Date(Number(docInfo.timestamp) * 1000).toLocaleString()}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start gap-1">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-24 shrink-0 mt-0.5">Signature</span>
              <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400 break-all">
                {docInfo.signature.slice(0, 24)}…{docInfo.signature.slice(-10)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
