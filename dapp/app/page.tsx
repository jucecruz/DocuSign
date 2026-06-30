'use client'

import { useState } from 'react'
import { Wallet, ChevronDown, Unplug } from 'lucide-react'
import { useWallet } from '@/contexts/MetaMaskContext'
import { DocumentSigner } from '@/components/DocumentSigner'
import { DocumentVerifier } from '@/components/DocumentVerifier'
import { DocumentHistory } from '@/components/DocumentHistory'

type Tab = 'upload' | 'verify' | 'history'

const TABS: { id: Tab; label: string }[] = [
  { id: 'upload', label: 'Upload & Sign' },
  { id: 'verify', label: 'Verify' },
  { id: 'history', label: 'History' },
]

export default function Home() {
  const { wallets, activeWallet, isConnected, connect, disconnect, switchWallet } = useWallet()
  const [activeTab, setActiveTab] = useState<Tab>('upload')
  const [walletOpen, setWalletOpen] = useState(false)

  const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">DocAuth</h1>
            <p className="text-xs text-zinc-400">Document Authentication on Ethereum</p>
          </div>

          {/* Wallet selector */}
          <div className="relative">
            {!isConnected ? (
              <button
                onClick={() => setWalletOpen((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            ) : (
              <button
                onClick={() => setWalletOpen((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-mono">{shortAddress(activeWallet!.address)}</span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>
            )}

            {walletOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Anvil Wallets</p>
                </div>
                <ul className="max-h-64 overflow-y-auto">
                  {wallets.map((w, i) => (
                    <li key={w.address}>
                      <button
                        onClick={() => {
                          isConnected ? switchWallet(i) : connect(i)
                          setWalletOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3 ${activeWallet?.address === w.address ? 'bg-zinc-50 dark:bg-zinc-800' : ''}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeWallet?.address === w.address ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                        <span>
                          <span className="text-zinc-400 mr-2">#{i}</span>
                          <span className="font-mono text-zinc-700 dark:text-zinc-300">{shortAddress(w.address)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {isConnected && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 p-2">
                    <button
                      onClick={() => { disconnect(); setWalletOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
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

      {/* Click-away overlay */}
      {walletOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setWalletOpen(false)} />
      )}

      {/* Main content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Tabs */}
          <nav className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            {activeTab === 'upload' && <DocumentSigner />}
            {activeTab === 'verify' && <DocumentVerifier />}
            {activeTab === 'history' && <DocumentHistory />}
          </div>
        </div>
      </main>
    </div>
  )
}
