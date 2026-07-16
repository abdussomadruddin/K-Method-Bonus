import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Digital Dominate",
  title: "Digital Dominate — Portal Pembelajaran",
  description: "Portal video pembelajaran eksklusif Digital Dominate.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Digital Dominate", statusBarStyle: "black-translucent" },
  openGraph: { title: "Digital Dominate", description: "Belajar dengan fokus. Kuasa dengan ilmu.", type: "website", images: [{ url: "/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: "Digital Dominate", description: "Belajar dengan fokus. Kuasa dengan ilmu.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ms"><body>{children}</body></html>;
}
