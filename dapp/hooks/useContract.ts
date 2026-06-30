'use client'

import { useCallback } from 'react'
import { ethers } from 'ethers'
import { useWallet } from '@/contexts/MetaMaskContext'
import { DOCUMENT_REGISTRY_ABI } from '@/lib/abi'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ''

export interface DocumentInfo {
  hash: string
  timestamp: bigint
  signer: string
  signature: string
}

export function useContract() {
  const { provider, getSigner } = useWallet()

  const getReadContract = useCallback(() => {
    return new ethers.Contract(CONTRACT_ADDRESS, DOCUMENT_REGISTRY_ABI, provider)
  }, [provider])

  const getWriteContract = useCallback(() => {
    const signer = getSigner()
    if (!signer) throw new Error('No wallet connected')
    return new ethers.Contract(CONTRACT_ADDRESS, DOCUMENT_REGISTRY_ABI, signer)
  }, [getSigner])

  const storeDocumentHash = useCallback(
    async (hash: string, timestamp: number, signature: string, signerAddress: string) => {
      const contract = getWriteContract()
      const tx = await contract.storeDocumentHash(hash, timestamp, signature, signerAddress)
      return tx.wait()
    },
    [getWriteContract]
  )

  const verifyDocument = useCallback(
    async (hash: string, signerAddress: string, signature: string): Promise<boolean> => {
      const contract = getWriteContract()
      const tx = await contract.verifyDocument(hash, signerAddress, signature)
      const receipt = await tx.wait()
      // Read the result from the emitted DocumentVerified event
      const iface = new ethers.Interface(DOCUMENT_REGISTRY_ABI)
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log)
          if (parsed?.name === 'DocumentVerified') {
            return parsed.args.valid as boolean
          }
        } catch {
          // skip unparseable logs
        }
      }
      return false
    },
    [getWriteContract]
  )

  const getDocumentInfo = useCallback(
    async (hash: string): Promise<DocumentInfo> => {
      const contract = getReadContract()
      const result = await contract.getDocumentInfo(hash)
      return {
        hash: result.hash as string,
        timestamp: result.timestamp as bigint,
        signer: result.signer as string,
        signature: result.signature as string,
      }
    },
    [getReadContract]
  )

  const isDocumentStored = useCallback(
    async (hash: string): Promise<boolean> => {
      const contract = getReadContract()
      return contract.isDocumentStored(hash) as Promise<boolean>
    },
    [getReadContract]
  )

  const getDocumentCount = useCallback(async (): Promise<bigint> => {
    const contract = getReadContract()
    return contract.getDocumentCount() as Promise<bigint>
  }, [getReadContract])

  const getDocumentHashByIndex = useCallback(
    async (index: number): Promise<string> => {
      const contract = getReadContract()
      return contract.getDocumentHashByIndex(index) as Promise<string>
    },
    [getReadContract]
  )

  return {
    storeDocumentHash,
    verifyDocument,
    getDocumentInfo,
    isDocumentStored,
    getDocumentCount,
    getDocumentHashByIndex,
  }
}
