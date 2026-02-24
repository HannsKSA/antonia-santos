import Link from 'next/link';

export default function Home() {
  return (
    <main>
      {/* Hero Section */}
      <section style={{
        padding: '6rem 0',
        background: 'radial-gradient(circle at top right, #e2e8f0 0%, #f8fafc 100%)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Marca de Agua Logo */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '550px',
          height: 'auto',
          opacity: 0.15,
          pointerEvents: 'none',
          zIndex: 0,
          filter: 'grayscale(0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <img
            src="/logo.png"
            alt="Watermark"
            style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
          />
        </div>
        <div className="container animate-fade-in" style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '3.5rem', marginBottom: '1.5rem', maxWidth: '800px', margin: '0 auto 1.5rem' }}>
            Transformando la Comunicación en Nuestra Comunidad
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 3rem' }}>
            Un espacio democrático y participativo para padres, docentes y estudiantes de la
            IE Antonia Santos.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href="/register" className="btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }}>
              Solicitar Acceso
            </Link>
            <Link href="/dashboard" className="btn-accent" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', background: 'transparent', border: '2px solid var(--accent)' }}>
              Ver Noticias
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ padding: '5rem 0' }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2.5rem'
          }}>
            <div className="glass-card" style={{ padding: '2.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📰</div>
              <h3 style={{ marginBottom: '1rem' }}>Comunicación Transparente</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Mantente al día con las noticias y eventos de tu grado.
                Confirma tu lectura con un solo clic.
              </p>
            </div>
            <div className="glass-card" style={{ padding: '2.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🗳️</div>
              <h3 style={{ marginBottom: '1rem' }}>Votación Democrática</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Participa en encuestas oficiales y toma de decisiones que afectan
                el futuro de la institución.
              </p>
            </div>
            <div className="glass-card" style={{ padding: '2.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💡</div>
              <h3 style={{ marginBottom: '1rem' }}>Propuestas Ciudadanas</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Propón ideas, debate con otros padres y ve cómo tus sugerencias
                se transforman en realidad.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats / Proof Section */}
      <section style={{ padding: '5rem 0', background: 'var(--primary)', color: 'white' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--accent)' }}>+500</div>
            <p>Padres Conectados</p>
          </div>
          <div>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--accent)' }}>100%</div>
            <p>Transparencia</p>
          </div>
          <div>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--accent)' }}>24/7</div>
            <p>Participación</p>
          </div>
        </div>
      </section>
    </main>
  );
}
