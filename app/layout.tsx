import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'معارفك',
  description: 'معارف جديدة تبدأ بخطوة',
  applicationName: 'معارفك',
  appleWebApp: {
    capable: true,
    title: 'معارفك',
    statusBarStyle: 'default',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#1560BD',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
