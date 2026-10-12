import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bridge Platform",
  description: "Corporate onboarding and KYC verification workflow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body
        className="flex h-screen w-screen flex-col overflow-hidden bg-background text-on-surface"
        suppressHydrationWarning
      >
        <Navbar />
        <main className="thin-scrollbar flex-1 overflow-y-auto overflow-x-hidden">
          <OnboardingProvider>{children}</OnboardingProvider>
        </main>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
