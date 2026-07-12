import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bonus K-Method — Portal Pembelajaran",
  description: "Portal video pembelajaran eksklusif Bonus K-Method.",
  openGraph: { title: "Bonus K-Method", description: "Belajar dengan fokus. Kuasa dengan ilmu.", type: "website", images: [{ url: "/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: "Bonus K-Method", description: "Belajar dengan fokus. Kuasa dengan ilmu.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ms"><body>{children}</body></html>;
}
