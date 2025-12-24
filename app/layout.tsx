import type { Metadata } from "next"
import { Noto_Sans_JP } from "next/font/google"
import "./globals.css"
import Sidebar from "@/components/layout/Sidebar"

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
})

export const metadata: Metadata = {
  title: "Lion System - 人材紹介管理システム",
  description: "株式会社リオンの人材紹介業務管理システム",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} font-sans antialiased bg-[#f8fafc]`}>
        <Sidebar />
        <main className="ml-[200px] min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
