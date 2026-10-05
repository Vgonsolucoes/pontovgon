import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: {
    default: "VGON PONTO | Controle de Jornada",
    template: "%s · VGON PONTO",
  },
  description:
    "Sistema profissional de controle de jornada da Vgon Soluções em Informática. Integração com Control iD iDFace via agente local.",
  applicationName: "VGON PONTO",
  authors: [{ name: "Vgon Soluções em Informática", url: "https://vgon.com.br" }],
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
  robots: "noindex,nofollow",
};

export const viewport: Viewport = {
  themeColor: [{ color: "#1e6feb" }, { media: "(prefers-color-scheme: dark)", color: "#0b2a5c" }],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50">
        {children}
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "shadow-lg rounded-lg",
            },
          }}
        />
      </body>
    </html>
  );
}
