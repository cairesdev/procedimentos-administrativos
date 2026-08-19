import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { app } from "@/shared/config/app";
import { Toaster } from "@/shared/ui/toaster";
import "./globals.css";

// next/font baixa a fonte no build: o Docker build precisa de rede.
const inter = Inter({
  variable: "--fonte_inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: app.name,
  description: app.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
