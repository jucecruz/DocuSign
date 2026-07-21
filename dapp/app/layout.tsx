/**
 * layout.tsx — Layout raíz de la aplicación Next.js (App Router).
 *
 * Este archivo envuelve TODAS las páginas de la app. Aquí se configuran:
 *   - Las fuentes globales (Geist Sans y Geist Mono via next/font).
 *   - Los metadatos HTML (<title> y <meta description>).
 *   - El proveedor de contexto de wallet (WalletProvider), que debe estar
 *     disponible en todo el árbol de componentes.
 *
 * En Next.js App Router, este archivo exporta un componente `RootLayout`
 * que recibe `children` (el contenido de cada página) y lo renderiza dentro
 * de las etiquetas <html> y <body>.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/contexts/MetaMaskContext";

// Carga la fuente Geist Sans y la expone como variable CSS --font-geist-sans
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Carga la fuente Geist Mono y la expone como variable CSS --font-geist-mono
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadatos estáticos que Next.js inyecta en el <head> de cada página
export const metadata: Metadata = {
  title: "Autenticidad de Documentos Digitales — Firmas de documentos digitales en Ethereum",
  description: "Store and verify document authenticity using blockchain",
};

/**
 * Layout raíz. Se renderiza una sola vez y persiste entre navegaciones.
 * @param children  Contenido de la página activa (inyectado por Next.js).
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Las variables de fuente se aplican al elemento <html> para que estén
    // disponibles en toda la hoja de estilos via Tailwind / CSS custom props
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
        {/* WalletProvider expone el contexto de wallet a todos los componentes hijo */}
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
