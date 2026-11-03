import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-fredoka" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "Soft Baked Stories — Home-baked muffins & banana bread",
  description:
    "Home-baked muffins and banana breads, delivered. Order Choco Lava, Carrot, Banana and S'mores muffins or a fresh loaf of banana bread.",
  icons: { icon: "/images/logo.png" },
};

export const viewport: Viewport = { themeColor: "#fbf5f1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="font-sans antialiased">
        <div className="backdrop" aria-hidden />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
