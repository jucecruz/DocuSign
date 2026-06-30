'use client'

import { useState } from 'react'
import { ethers } from 'ethers'
import { ShieldCheck, ShieldX, Search } from 'lucide-react'
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
      <FileUploader onHashReady={handleHashReady} />

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Signer Address <span className="text-zinc-400 font-normal">(optional — leave empty to skip signer check)</span>
        </label>
        <input
          type="text"
          value={signerInput}
          onChange={(e) => setSignerInput(e.target.value)}
          placeholder="0x..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
      </div>

      <button
        onClick={verify}
        disabled={!hash || loading || !isConnected}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
      >
        <Search className="w-4 h-4" />
        {loading ? 'Verifying...' : 'Verify Document'}
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {result === 'not-found' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
          <ShieldX className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-zinc-700 dark:text-zinc-300">Not found on blockchain</p>
            <p className="text-sm text-zinc-500 mt-0.5">This document has not been registered.</p>
          </div>
        </div>
      )}

      {(result === 'valid' || result === 'invalid') && docInfo && (
        <div className={`rounded-xl border p-4 space-y-3 ${result === 'valid' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'}`}>
          <div className="flex items-center gap-2">
            {result === 'valid'
              ? <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
              : <ShieldX className="w-5 h-5 text-red-600 dark:text-red-400" />
            }
            <span className={`font-semibold ${result === 'valid' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {result === 'valid' ? 'Document is authentic' : 'Signer mismatch'}
            </span>
          </div>
          <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <p><span className="font-medium">Signer:</span> <span className="font-mono">{docInfo.signer}</span></p>
            <p><span className="font-medium">Stored at:</span> {new Date(Number(docInfo.timestamp) * 1000).toLocaleString()}</p>
            <p><span className="font-medium">Signature:</span> <span className="font-mono">{docInfo.signature.slice(0, 20)}...{docInfo.signature.slice(-8)}</span></p>
          </div>
        </div>
      )}
    </div>
  )
}
