'use client'

import { useState } from 'react'
import { ethers } from 'ethers'
import { PenLine, Database, CheckCircle } from 'lucide-react'
import { FileUploader } from './FileUploader'
import { useWallet } from '@/contexts/MetaMaskContext'
import { useContract } from '@/hooks/useContract'

export function DocumentSigner() {
  const { isConnected, activeWallet, signMessage } = useWallet()
  const { storeDocumentHash } = useContract()

  const [hash, setHash] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [step, setStep] = useState<'idle' | 'signing' | 'signed' | 'storing' | 'stored'>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleHashReady = (computed: string, selectedFile: File) => {
    setHash(computed)
    setFile(selectedFile)
    setSignature(null)
    setTxHash(null)
    setStep('idle')
    setError(null)
  }

  const handleSign = async () => {
    if (!hash || !activeWallet) return
    const confirmed = window.confirm(
      `You are about to sign the following hash with wallet ${activeWallet.address.slice(0, 10)}...\n\n${hash}\n\nProceed?`
    )
    if (!confirmed) return

    setStep('signing')
    setError(null)
    try {
      const sig = await signMessage(ethers.getBytes(hash))
      setSignature(sig)
      setStep('signed')
      alert(`Signature generated successfully:\n${sig.slice(0, 40)}...`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed')
      setStep('idle')
    }
  }

  const handleStore = async () => {
    if (!hash || !signature || !activeWallet) return
    const confirmed = window.confirm(
      `You are about to store this document on the blockchain.\n\nHash: ${hash.slice(0, 20)}...\nSigner: ${activeWallet.address}\n\nThis action is IRREVERSIBLE. Proceed?`
    )
    if (!confirmed) return

    setStep('storing')
    setError(null)
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const receipt = await storeDocumentHash(hash, timestamp, signature, activeWallet.address)
      setTxHash(receipt?.hash ?? null)
      setStep('stored')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed')
      setStep('signed')
    }
  }

  return (
    <div className="space-y-6">
      <FileUploader onHashReady={handleHashReady} />

      {!isConnected && (
        <p className="text-sm text-amber-600 dark:text-amber-400">Connect a wallet to sign and store documents.</p>
      )}

      {hash && isConnected && step !== 'stored' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSign}
            disabled={step === 'signing' || step === 'storing'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 text-sm font-medium disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <PenLine className="w-4 h-4" />
            {step === 'signing' ? 'Signing...' : signature ? 'Re-sign' : 'Sign Document'}
          </button>

          {signature && (
            <button
              onClick={handleStore}
              disabled={step === 'storing'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              <Database className="w-4 h-4" />
              {step === 'storing' ? 'Storing...' : 'Store on Blockchain'}
            </button>
          )}
        </div>
      )}

      {signature && step !== 'stored' && (
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 space-y-1">
          <p className="text-xs text-zinc-400">Signature</p>
          <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 break-all">{signature}</p>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {step === 'stored' && txHash && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-green-700 dark:text-green-300">
              {file?.name} stored on blockchain
            </p>
            <p className="text-xs text-zinc-500">
              Transaction: <span className="font-mono">{txHash.slice(0, 20)}...{txHash.slice(-8)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
