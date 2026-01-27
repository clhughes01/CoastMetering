import React from "react"
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Coast Metering - Submetering & Utility Services',
  description: 'Professional water submetering and utility billing platform for property managers and tenants',
  icons: {
    icon: [
      {
        url: '/favicon.png',
        type: 'image/png',
      },
      {
        url: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
    ],
    apple: '/apple-icon.png',
    shortcut: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
