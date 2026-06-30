'use client'

import { useState } from 'react'
import { ethers } from 'ethers'
import { PenLine, Database, CheckCircle, Wallet } from 'lucide-react'
import { FileUploader } from './FileUploader'
import { useWallet } from '@/contexts/MetaMaskContext'
import { useContract } from '@/hooks/useContract'

// Pasos del flujo de firma/almacenamiento
const STEPS = [
  { n: 1, label: 'Upload file' },
  { n: 2, label: 'Sign hash' },
  { n: 3, label: 'Store on-chain' },
]

export function DocumentSigner() {
  const { isConnected, activeWallet, signMessage } = useWallet()
  const { storeDocumentHash } = useContract()

  const [hash, setHash] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [step, setStep] = useState<'idle' | 'signing' | 'signed' | 'storing' | 'stored'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Paso actual como número (1, 2, 3) para el indicador visual
  const currentStep = step === 'stored' ? 3 : signature ? 2 : hash ? 1 : 0

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
      `Sign the hash with wallet ${activeWallet.address.slice(0, 10)}...\n\n${hash}\n\nProceed?`
    )
    if (!confirmed) return
    setStep('signing')
    setError(null)
    try {
      const sig = await signMessage(ethers.getBytes(hash))
      setSignature(sig)
      setStep('signed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed')
      setStep('idle')
    }
  }

  const handleStore = async () => {
    if (!hash || !signature || !activeWallet) return
    const confirmed = window.confirm(
      `Store this document on the blockchain?\n\nHash: ${hash.slice(0, 20)}...\nSigner: ${activeWallet.address}\n\nThis action is IRREVERSIBLE.`
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

      {/* Indicador de pasos */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                currentStep >= s.n
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
              }`}>
                {s.n}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap hidden sm:block ${
                currentStep >= s.n ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400'
              }`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-5 transition-colors ${
                currentStep > s.n ? 'bg-indigo-300 dark:bg-indigo-700' : 'bg-zinc-200 dark:bg-zinc-700'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Paso 1: Upload */}
      <FileUploader onHashReady={handleHashReady} />

      {/* Aviso: sin wallet */}
      {!isConnected && hash && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
          <Wallet className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">Connect a wallet to sign and store this document.</p>
        </div>
      )}

      {/* Acciones: Pasos 2 y 3 */}
      {hash && isConnected && step !== 'stored' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSign}
            disabled={step === 'signing' || step === 'storing'}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-sm font-medium disabled:opacity-40 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            {step === 'signing'
              ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> Signing…</>
              : <><PenLine className="w-4 h-4" /> {signature ? 'Re-sign' : 'Sign Document'}</>
            }
          </button>

          {signature && (
            <button
              onClick={handleStore}
              disabled={step === 'storing'}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-40 transition-colors shadow-sm shadow-indigo-600/25"
            >
              {step === 'storing'
                ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Storing…</>
                : <><Database className="w-4 h-4" /> Store on Blockchain</>
              }
            </button>
          )}
        </div>
      )}

      {/* Firma generada */}
      {signature && step !== 'stored' && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">ECDSA Signature</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-mono text-zinc-600 dark:text-zinc-300 break-all leading-relaxed">{signature}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Éxito */}
      {step === 'stored' && txHash && (
        <div className="flex items-start gap-4 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/20">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-1 min-w-0">
            <p className="font-semibold text-emerald-700 dark:text-emerald-300 truncate">
              {file?.name} stored on blockchain
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tx: <span className="font-mono">{txHash.slice(0, 22)}…{txHash.slice(-8)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
