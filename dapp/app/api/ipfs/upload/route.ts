/**
 * route.ts — API Route servidor para subir archivos a Pinata IPFS.
 *
 * Por qué existe este proxy:
 *   Las credenciales de Pinata (API Key + Secret Key) NO deben exponerse
 *   en el navegador. Al usar este API Route de Next.js, las claves se leen
 *   del entorno servidor (sin prefijo NEXT_PUBLIC_) y nunca llegan al cliente.
 *
 * Variables de entorno requeridas en .env.local (sin NEXT_PUBLIC_):
 *   PINATA_API_KEY=<tu api key>
 *   PINATA_SECRET_KEY=<tu secret key>
 *
 * Uso interno (desde lib/ipfs.ts cuando NEXT_PUBLIC_IPFS_PROVIDER=pinata):
 *   POST /api/ipfs/upload
 *   Body: FormData con campo "file"
 *   Response: { cid: string }
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey    = process.env.PINATA_API_KEY
  const secretKey = process.env.PINATA_SECRET_KEY

  if (!apiKey || !secretKey) {
    return NextResponse.json(
      { error: 'Pinata credentials not configured. Set PINATA_API_KEY and PINATA_SECRET_KEY in .env.local' },
      { status: 500 }
    )
  }

  // Reenviar el FormData recibido del cliente directamente a Pinata
  const formData = await req.formData()

  const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      pinata_api_key:        apiKey,
      pinata_secret_api_key: secretKey,
    },
    body: formData,
  })

  if (!pinataResponse.ok) {
    const errorText = await pinataResponse.text().catch(() => pinataResponse.statusText)
    return NextResponse.json(
      { error: `Pinata error (${pinataResponse.status}): ${errorText}` },
      { status: pinataResponse.status }
    )
  }

  const data = await pinataResponse.json() as { IpfsHash: string }
  // Devolver el CID con un nombre consistente independientemente del proveedor
  return NextResponse.json({ cid: data.IpfsHash })
}
