/// <reference types="vite/client" />

interface Window {
  ethereum?: import("viem").EIP1193Provider
}

// Resolved in vite.config.ts from VITE_{TERMS,PRIVACY,IMPRINT}_URL
declare const __TERMS_URL__: string
declare const __PRIVACY_URL__: string
declare const __IMPRINT_URL__: string
declare const __TERMS_HTML__: string
declare const __PRIVACY_HTML__: string
declare const __IMPRINT_HTML__: string
