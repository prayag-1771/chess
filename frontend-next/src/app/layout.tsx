import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chess 3D — Play Online',
  description: 'Experience chess like never before with a stunning 3D board and real-time online multiplayer.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
