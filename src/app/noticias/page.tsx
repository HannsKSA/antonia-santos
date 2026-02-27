import NewsFeed from '@/components/NewsFeed';

export default function NoticiasPublicasPage() {
    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingTop: '20px' }}>

            <div className="container" style={{ padding: '2rem 1rem', maxWidth: '800px' }}>
                <header style={{ textAlign: 'center', marginBottom: '3rem', paddingTop: '2rem' }}>
                    <h1 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>📰 Noticias Institucionales</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                        Comunicados oficiales y novedades de la IE Antonia Santos para toda la comunidad.
                    </p>
                </header>

                <NewsFeed onlyPublic={true} />

                <footer style={{ marginTop: '4rem', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '2rem', paddingBottom: '3rem' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        ¿Eres parte de la comunidad? <a href="/login" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Inicia sesión</a> para ver noticias específicas de tu grado.
                    </p>
                </footer>
            </div>
        </div>
    );
}
