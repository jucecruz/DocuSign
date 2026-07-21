/**
 * ipfs.ts — Utilidad de integración con IPFS para DocAuth.
 *
 * Soporta dos proveedores configurables via variables de entorno:
 *
 *   NEXT_PUBLIC_IPFS_PROVIDER=local (predeterminado)
 *     → Sube directamente al nodo Kubo local en NEXT_PUBLIC_IPFS_API_URL.
 *       No requiere credenciales. Arrancar con: `ipfs daemon`
 *
 *   NEXT_PUBLIC_IPFS_PROVIDER=pinata
 *     → Sube via el API Route /api/ipfs/upload (proxy servidor).
 *       Las credenciales Pinata están en el servidor (sin NEXT_PUBLIC_),
 *       nunca se exponen al navegador.
 *
 * Variables de entorno requeridas en .env.local:
 *   NEXT_PUBLIC_IPFS_PROVIDER=local|pinata
 *   NEXT_PUBLIC_IPFS_API_URL=http://localhost:5001   (solo para provider=local)
 *   NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs   (gateway público para links de descarga)
 */

export type IPFSProvider = 'local' | 'pinata'

const IPFS_PROVIDER = (process.env.NEXT_PUBLIC_IPFS_PROVIDER ?? 'local') as IPFSProvider
const IPFS_API_URL  = process.env.NEXT_PUBLIC_IPFS_API_URL ?? 'http://localhost:5001'
const IPFS_GATEWAY  = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? 'https://ipfs.io/ipfs'

/**
 * Construye la URL pública de descarga de un archivo dado su CID.
 * El gateway es configurable via NEXT_PUBLIC_IPFS_GATEWAY.
 *
 * @param cid CID de IPFS (ej. "QmXxx..." o "bafyxxx...").
 * @returns URL completa al gateway (ej. "https://ipfs.io/ipfs/QmXxx...").
 */
export function getCIDGatewayURL(cid: string): string {
  if (!cid) return ''
  return `${IPFS_GATEWAY}/${cid}`
}

/**
 * Sube un archivo a IPFS usando el proveedor configurado y devuelve su CID.
 *
 * @param file Archivo del usuario a subir.
 * @returns CID de IPFS asignado al archivo (ej. "QmXxx...").
 * @throws Error si el upload falla o el proveedor no responde.
 */
export async function uploadToIPFS(file: File): Promise<string> {
  if (IPFS_PROVIDER === 'pinata') {
    return uploadViaPinataProxy(file)
  }
  return uploadToLocalKubo(file)
}

/**
 * Sube el archivo directamente al nodo Kubo local via su API HTTP REST.
 * Requiere que `ipfs daemon` esté corriendo en NEXT_PUBLIC_IPFS_API_URL.
 *
 * Endpoint: POST /api/v0/add
 * Respuesta: { Hash, Name, Size }  (formato JSON Lines de Kubo)
 */
async function uploadToLocalKubo(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  let response: Response
  try {
    response = await fetch(`${IPFS_API_URL}/api/v0/add?pin=true`, {
      method: 'POST',
      body: formData,
    })
  } catch {
    // ERR_CONNECTION_REFUSED: el daemon de IPFS no está corriendo
    throw new Error(
      `No se pudo conectar al nodo IPFS en ${IPFS_API_URL}. ` +
      `Ejecuta "ipfs daemon" en una terminal e intenta de nuevo.`
    )
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new Error(`IPFS local upload failed (${response.status}): ${text}`)
  }

  // Kubo devuelve JSON Lines; la última línea contiene el CID del archivo raíz
  const text = await response.text()
  const lastLine = text.trim().split('\n').pop() ?? ''
  const data = JSON.parse(lastLine) as { Hash: string }
  return data.Hash
}

/**
 * Sube el archivo a Pinata via el API Route de Next.js (/api/ipfs/upload).
 * Las credenciales de Pinata permanecen en el servidor (no se exponen al navegador).
 */
async function uploadViaPinataProxy(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/ipfs/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText })) as { error: string }
    throw new Error(`Pinata upload failed: ${err.error}`)
  }

  const data = await response.json() as { cid: string }
  return data.cid
}
