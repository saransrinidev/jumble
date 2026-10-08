import type { ReactNode } from 'react'

export const metadata = { title: 'Jumble Backend', description: 'API-only backend for the Jumble game.' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
