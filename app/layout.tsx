import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import { AppThemeProvider } from "@/components/AppThemeProvider";
import { ThemeToggleGate } from "@/components/ThemeToggleGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmartGuest",
  description: "Plataforma de logística integral para eventos",
  icons: {
    icon: [{ url: "/smartguest-favicon.png", type: "image/png" }],
    apple: [{ url: "/smartguest-favicon.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppThemeProvider>
          <ThemeToggleGate />
          {children}
        </AppThemeProvider>
      </body>
    </html>
  );
}
