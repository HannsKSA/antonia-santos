import type { Metadata } from "next";
import "./globals.css";
import Link from 'next/link';

export const metadata: Metadata = {
  title: "IE Antonia Santos - Consejo de Padres",
  description: "Sistema de Gestión Comunitaria para el Consejo de Padres y Representantes de la Institución Educativa Antonia Santos.",
};

import Navbar from "@/components/Navbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <Navbar />
        {children}
        <footer style={{ background: 'var(--primary)', color: 'white', padding: '4rem 0', marginTop: '4rem' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <h3 style={{ color: 'var(--accent)', marginBottom: '1rem' }}>I.E. Antonia Santos</h3>
            <p style={{ opacity: 0.8 }}>© 2024 Consejo de Padres y Representantes. Todos los derechos reservados.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
