'use client'

/**
 * DocumentSigner.tsx — Componente de firma y almacenamiento de documentos con IPFS opcional.
 *
 * Flujo de 4 pasos:
 *   1. UPLOAD    → Selección de archivo; FileUploader calcula el hash keccak256.
 *   2. IPFS      → (Opcional) Subida del archivo a IPFS para obtener un CID.
 *                  El usuario puede saltar este paso si no tiene IPFS disponible.
 *   3. SIGN      → El hash se firma con la clave privada de la wallet activa.
 *   4. STORE     → Se envía la transacción al contrato con hash + CID + firma.
 *
 * Si el paso IPFS se salta, se almacena cid="" en el contrato (el documento
 * podrá verificarse por hash pero no tendrá link de descarga en IPFS).
 */

import { useState } from 'react'
import { ethers } from 'ethers'
import { PenLine, Database, CheckCircle, Wallet, Link2, SkipForward, CloudUpload } from 'lucide-react'
import { FileUploader } from './FileUploader'
import { useWallet } from '@/contexts/MetaMaskContext'
import { useContract } from '@/hooks/useContract'
import { uploadToIPFS, getCIDGatewayURL } from '@/lib/ipfs'

// Pasos del flujo de firma/almacenamiento
const STEPS = [
  { n: 1, label: 'Upload' },
  { n: 2, label: 'IPFS' },
  { n: 3, label: 'Sign' },
  { n: 4, label: 'Store' },
]

type IPFSStep = 'idle' | 'uploading' | 'done' | 'skipped'

export function DocumentSigner() {
  const { isConnected, activeWallet, signMessage } = useWallet()
  const { storeDocumentHash } = useContract()

  // Estado del archivo y su hash
  const [hash, setHash]       = useState<string | null>(null)
  const [file, setFile]       = useState<File | null>(null)

  // Estado IPFS
  const [cid, setCid]         = useState<string | null>(null)
  const [ipfsStep, setIpfsStep] = useState<IPFSStep>('idle')
  const [ipfsError, setIpfsError] = useState<string | null>(null)

  // Estado de firma/almacenamiento
  const [signature, setSignature] = useState<string | null>(null)
  const [txHash, setTxHash]       = useState<string | null>(null)
  const [step, setStep]           = useState<'idle' | 'signing' | 'signed' | 'storing' | 'stored'>('idle')
  const [error, setError]         = useState<string | null>(null)

  // Paso visual actual (1-4) para el indicador de progreso
  const currentStep =
    step === 'stored'  ? 4 :
    signature          ? 3 :
    (ipfsStep === 'done' || ipfsStep === 'skipped') ? 2 :
    hash               ? 1 : 0

  const handleHashReady = (computed: string, selectedFile: File) => {
    setHash(computed)
    setFile(selectedFile)
    // Reiniciar todo el estado al cargar un nuevo archivo
    setCid(null)
    setIpfsStep('idle')
    setIpfsError(null)
    setSignature(null)
    setTxHash(null)
    setStep('idle')
    setError(null)
  }

  // ── Paso 2: subir a IPFS ──────────────────────────────────────────────────

  const handleIPFSUpload = async () => {
    if (!file) return
    setIpfsStep('uploading')
    setIpfsError(null)
    try {
      const uploadedCID = await uploadToIPFS(file)
      setCid(uploadedCID)
      setIpfsStep('done')
    } catch (e) {
      setIpfsError(e instanceof Error ? e.message : 'IPFS upload failed')
      setIpfsStep('idle')
    }
  }

  const handleSkipIPFS = () => {
    setCid(null)
    setIpfsStep('skipped')
  }

  // ── Paso 3: firmar el hash ────────────────────────────────────────────────

  const handleSign = async () => {
    if (!hash || !activeWallet) return
    const confirmed = window.confirm(
      `Sign the hash with wallet ${activeWallet.address.slice(0, 10)}...\n\n${hash}\n\nProceed?`
    )
    if (!confirmed) return
    setStep('signing')
    setError(null)
    try {
      // Firma los bytes del hash (no el string hex) para producir una firma ECDSA estándar
      const sig = await signMessage(ethers.getBytes(hash))
      setSignature(sig)
      setStep('signed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed')
      setStep('idle')
    }
  }

  // ── Paso 4: almacenar en la blockchain ───────────────────────────────────

  const handleStore = async () => {
    if (!hash || !signature || !activeWallet) return
    const confirmed = window.confirm(
      `Store on blockchain?\n\nHash: ${hash.slice(0, 20)}...\nSigner: ${activeWallet.address}${cid ? `\nIPFS CID: ${cid}` : '\nIPFS: skipped'}\n\nThis action is IRREVERSIBLE.`
    )
    if (!confirmed) return
    setStep('storing')
    setError(null)
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      // Pasar cid || "" — el contrato acepta string vacío cuando no se usa IPFS
      const receipt = await storeDocumentHash(hash, cid ?? '', timestamp, signature, activeWallet.address)
      setTxHash(receipt?.hash ?? null)
      setStep('stored')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed')
      setStep('signed')
    }
  }

  const ipfsDone = ipfsStep === 'done' || ipfsStep === 'skipped'

  return (
    <div className="space-y-6">

      {/* ── Indicador de pasos ── */}
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

      {/* ── Paso 1: Upload ── */}
      <FileUploader onHashReady={handleHashReady} />

      {/* ── Paso 2: IPFS (opcional) ── */}
      {hash && step !== 'stored' && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
            <CloudUpload className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Step 2 — Pin to IPFS
            </span>
            <span className="text-xs text-zinc-400 ml-1">(optional)</span>
          </div>
          <div className="px-4 py-4 space-y-3">
            {ipfsStep === 'idle' && (
              <>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Upload the file to IPFS to store it decentralized. Anyone with the CID can download the original.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleIPFSUpload}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors shadow-sm shadow-indigo-600/25"
                  >
                    <CloudUpload className="w-4 h-4" />
                    Upload to IPFS
                  </button>
                  <button
                    onClick={handleSkipIPFS}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 text-sm hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  >
                    <SkipForward className="w-4 h-4" />
                    Skip (hash only)
                  </button>
                </div>
              </>
            )}

            {ipfsStep === 'uploading' && (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                <p className="text-sm text-indigo-600 dark:text-indigo-400">Uploading to IPFS…</p>
              </div>
            )}

            {ipfsStep === 'done' && cid && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Pinned to IPFS successfully
                </p>
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 px-3 py-2 space-y-1">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">CID</p>
                  <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 break-all">{cid}</p>
                </div>
                <a
                  href={getCIDGatewayURL(cid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Link2 className="w-3 h-3" />
                  View on IPFS gateway ↗
                </a>
              </div>
            )}

            {ipfsStep === 'skipped' && (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">
                IPFS skipped — only the hash will be stored on-chain.
              </p>
            )}

            {ipfsError && (
              <p className="text-sm text-red-500 dark:text-red-400">{ipfsError}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Aviso: sin wallet ── */}
      {!isConnected && hash && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
          <Wallet className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">Connect a wallet to sign and store this document.</p>
        </div>
      )}

      {/* ── Pasos 3 y 4: Sign + Store ── */}
      {hash && isConnected && ipfsDone && step !== 'stored' && (
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

      {/* ── Éxito ── */}
      {step === 'stored' && txHash && (
        <div className="flex items-start gap-4 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/20">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-2 min-w-0">
            <p className="font-semibold text-emerald-700 dark:text-emerald-300 truncate">
              {file?.name} stored on blockchain
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tx: <span className="font-mono">{txHash.slice(0, 22)}…{txHash.slice(-8)}</span>
            </p>
            {cid && (
              <a
                href={getCIDGatewayURL(cid)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Link2 className="w-3 h-3" />
                Download from IPFS ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
