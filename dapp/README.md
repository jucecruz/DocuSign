# DocAuth — Frontend (Next.js)

Interfaz web para el sistema de certificación de documentos DocAuth. Calcula el hash `keccak256` de un archivo localmente, lo firma con una wallet HD, opcionalmente lo sube a IPFS, y almacena la evidencia en la blockchain Ethereum.

---

## Stack

| Tecnología | Versión | Rol |
|---|---|---|
| Next.js | 16.x (App Router) | Framework web |
| React | 19.x | UI |
| TypeScript | ^5 | Tipado estático |
| ethers.js | ^6 | Wallet + contrato |
| Tailwind CSS | ^4 | Estilos |
| lucide-react | ^1 | Iconos |

---

## Instalación

```bash
cd dapp
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

---

## Variables de entorno (`dapp/.env.local`)

```env
# Blockchain
NEXT_PUBLIC_CONTRACT_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_MNEMONIC="test test test test test test test test test test test junk"

# IPFS — opcional
NEXT_PUBLIC_IPFS_PROVIDER=local          # 'local' | 'pinata'
NEXT_PUBLIC_IPFS_API_URL=http://localhost:5001
NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs

# Pinata — solo si IPFS_PROVIDER=pinata (SIN prefijo NEXT_PUBLIC_)
PINATA_API_KEY=
PINATA_SECRET_KEY=
```

> El mnemonic de Anvil es público. Nunca usarlo en mainnet ni con fondos reales.

---

## Integración IPFS

La app soporta dos proveedores configurables via `NEXT_PUBLIC_IPFS_PROVIDER`:

### Opción A — Kubo local (`provider=local`)

Requiere tener [Kubo](https://docs.ipfs.tech/install/command-line/) instalado y corriendo:

```bash
ipfs daemon
```

Verificar que responde:
```bash
curl http://localhost:5001/api/v0/version
```

La app sube directamente al nodo local via `POST /api/v0/add?pin=true`. No requiere credenciales.

### Opción B — Pinata (`provider=pinata`)

1. Crear cuenta en [pinata.cloud](https://www.pinata.cloud/).
2. Generar API Key con permiso `pinFileToIPFS`.
3. Copiar `API Key` y `API Secret` en `.env.local` bajo `PINATA_API_KEY` / `PINATA_SECRET_KEY`.
4. Las claves **nunca** usan el prefijo `NEXT_PUBLIC_` — son server-side únicamente.
5. La app las expone via el API Route `/api/ipfs/upload` que actúa como proxy.

### IPFS es opcional

Si el usuario no tiene IPFS disponible, puede pulsar "Skip (hash only)" durante el flujo de firma. El documento se registra en blockchain solo con el hash; el campo `cid` queda vacío en el contrato. La verificación y el historial mostrarán "Not pinned to IPFS".

---

## Arquitectura de componentes

```
app/
├── layout.tsx              # Root layout + WalletProvider (contexto global)
├── page.tsx                # Tabs: Upload & Sign / Verify / History
├── globals.css             # Tailwind v4 + variables CSS
└── api/
    └── ipfs/upload/
        └── route.ts        # API Route: proxy server-side para Pinata

components/
├── FileUploader.tsx         # Drag & drop → calcula hash keccak256
├── DocumentSigner.tsx       # Flujo 4-pasos: Upload → IPFS → Sign → Store
├── DocumentVerifier.tsx     # Verifica autenticidad + link IPFS si disponible
└── DocumentHistory.tsx      # Historial paginado con columna IPFS

contexts/
└── MetaMaskContext.tsx      # WalletProvider: HD wallets desde mnemonic

hooks/
└── useContract.ts           # ethers.js: storeDocumentHash, getDocumentInfo…

lib/
├── abi.ts                   # ABI del contrato DocumentRegistry
└── ipfs.ts                  # uploadToIPFS(file) → CID, getCIDGatewayURL(cid)
```

### Flujo principal (DocumentSigner)

```
1. Upload    → FileUploader calcula keccak256 del archivo localmente
2. IPFS      → (Opcional) uploadToIPFS(file) → CID almacenado en el nodo
3. Sign      → wallet.signMessage(bytes(hash)) → firma ECDSA
4. Store     → storeDocumentHash(hash, cid, timestamp, signature, signer)
```

### Flujo de verificación (DocumentVerifier)

```
1. Seleccionar archivo → calcular hash
2. isDocumentStored(hash) → si false: "Not found"
3. getDocumentInfo(hash)  → signer, timestamp, signature, cid
4. (Opcional) comparar signer con dirección ingresada
5. Si cid != "": mostrar botón "Download from IPFS"
```

---

## Comandos útiles

```bash
npm run dev      # servidor de desarrollo en http://localhost:3000
npm run build    # build de producción
npm run lint     # ESLint
npx tsc --noEmit # verificar tipos sin compilar
```
