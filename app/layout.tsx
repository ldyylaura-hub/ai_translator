import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Translate Assistant",
  description: "Powered by Tencent Cloud AI",
};

import { BackgroundProvider } from "@/components/BackgroundProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <BackgroundProvider>
          {children}
        </BackgroundProvider>
      </body>
    </html>
  );
}
