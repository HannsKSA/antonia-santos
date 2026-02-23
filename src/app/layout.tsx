import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Consejo de Padres - I.E. Antonia Santos",
  description: "Sistema de Gestión Comunitaria para el Consejo de Padres y Representantes de la Institución Educativa Antonia Santos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <nav className="glass-card" style={{ 
          position: 'sticky', 
          top: '1rem', 
          margin: '1rem', 
          zIndex: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 2rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              background: 'var(--primary)', 
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'var(--accent)',
              fontWeight: 'bold'
            }}>AS</div>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Antonia Santos</span>
          </div>
          <div style={{ display: 'flex', gap: '2rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            <a href="#" style={{ color: 'var(--primary)' }}>Inicio</a>
            <a href="#">Noticias</a>
            <a href="#">Propuestas</a>
          </div>
          <div>
            <button className="btn-primary">Ingresar</button>
          </div>
        </nav>
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
