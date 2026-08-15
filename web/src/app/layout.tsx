import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/shared/ui/toaster";
import "./globals.css";

const inter = Inter({
  variable: "--fonte_inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Procedimentos administrativos",
  description: "Gestão de processos administrativos municipais",
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
