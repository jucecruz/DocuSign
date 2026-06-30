'use client'

import { useState } from 'react'
import { ShieldCheck, ChevronDown, Unplug, Wallet, FileText, Search, Clock } from 'lucide-react'
import { useWallet } from '@/contexts/MetaMaskContext'
import { DocumentSigner } from '@/components/DocumentSigner'
import { DocumentVerifier } from '@/components/DocumentVerifier'
import { DocumentHistory } from '@/components/DocumentHistory'

type Tab = 'upload' | 'verify' | 'history'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'upload', label: 'Sign & Store', icon: <FileText className="w-4 h-4" /> },
  { id: 'verify', label: 'Verify', icon: <Search className="w-4 h-4" /> },
  { id: 'history', label: 'History', icon: <Clock className="w-4 h-4" /> },
]

export default function Home() {
  const { wallets, activeWallet, isConnected, connect, disconnect, switchWallet } = useWallet()
  const [activeTab, setActiveTab] = useState<Tab>('upload')
  const [walletOpen, setWalletOpen] = useState(false)

  const shortAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950/30">

      {/* ------------------------------------------------------------------ */}
      {/* HEADER — sticky glassmorphism                                        */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/75 dark:bg-zinc-900/75 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-600/30">
              <ShieldCheck className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <div className="leading-none">
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">DocAuth</span>
              <span className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500 leading-none mt-0.5">
                Document Authentication on Ethereum
              </span>
            </div>
          </div>

          {/* Wallet selector */}
          <div className="relative">
            {!isConnected ? (
              <button
                onClick={() => setWalletOpen((v) => !v)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors shadow-sm shadow-indigo-600/25 active:scale-95"
              >
                <Wallet className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </button>
            ) : (
              <button
                onClick={() => setWalletOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                <span className="font-mono">{shortAddress(activeWallet!.address)}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              </button>
            )}

            {/* Dropdown de wallets */}
            {walletOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl shadow-zinc-900/10 dark:shadow-zinc-900/50 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                    <Wallet className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Anvil Wallets</p>
                </div>
                <ul className="max-h-64 overflow-y-auto py-1">
                  {wallets.map((w, i) => (
                    <li key={w.address}>
                      <button
                        onClick={() => { isConnected ? switchWallet(i) : connect(i); setWalletOpen(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                          activeWallet?.address === w.address
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          activeWallet?.address === w.address ? 'bg-indigo-500' : 'bg-zinc-300 dark:bg-zinc-600'
                        }`} />
                        <span className="text-zinc-400 dark:text-zinc-500 text-xs">#{i}</span>
                        <span className="font-mono text-xs">{shortAddress(w.address)}</span>
                        {activeWallet?.address === w.address && (
                          <span className="ml-auto text-[10px] font-medium text-indigo-500 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded-full">Active</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                {isConnected && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 p-2">
                    <button
                      onClick={() => { disconnect(); setWalletOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                    >
                      <Unplug className="w-4 h-4" />
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Overlay para cerrar dropdown */}
      {walletOpen && <div className="fixed inset-0 z-20" onClick={() => setWalletOpen(false)} />}

      {/* ------------------------------------------------------------------ */}
      {/* CONTENIDO PRINCIPAL                                                  */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-10">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-zinc-100/80 dark:bg-zinc-800/80 rounded-2xl w-fit backdrop-blur-sm">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-zinc-200/80 dark:ring-zinc-700/80'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Panel de contenido */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 sm:p-8 shadow-sm shadow-zinc-200/50 dark:shadow-zinc-950/50">
            {activeTab === 'upload' && <DocumentSigner />}
            {activeTab === 'verify' && <DocumentVerifier />}
            {activeTab === 'history' && <DocumentHistory />}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
        DocAuth &middot; Ethereum Anvil (Chain ID 31337)
      </footer>
    </div>
  )
}
