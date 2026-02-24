'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

export default function Navbar() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            setLoading(false);
        };
        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // No mostrar el botón de ingresar si ya estamos en login o registro
    const isAuthPage = pathname === '/login' || pathname === '/register';

    return (
        <nav className="glass-card" style={{
            position: 'sticky',
            top: '1rem',
            margin: '1rem',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 2rem'
        }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '1rem', textDecoration: 'none' }}>
                <img
                    src="/logo.png"
                    alt="Logo IE Antonia Santos"
                    style={{ width: '50px', height: 'auto', borderRadius: '4px' }}
                />
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.2rem' }}>IE Antonia Santos</span>
            </Link>

            <div style={{ display: 'flex', gap: '2rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <Link href="/" style={{ color: pathname === '/' ? 'var(--primary)' : 'inherit' }}>Inicio</Link>
                <Link href="/dashboard" style={{ color: pathname === '/dashboard' ? 'var(--primary)' : 'inherit' }}>Noticias</Link>
                <Link href="/dashboard" style={{ color: pathname === '/dashboard' ? 'var(--primary)' : 'inherit' }}>Propuestas</Link>
            </div>

            <div>
                {!loading && (
                    user ? (
                        <Link href="/dashboard" className="btn-primary">Mi Panel</Link>
                    ) : (
                        !isAuthPage && <Link href="/login" className="btn-primary">Ingresar</Link>
                    )
                )}
            </div>
        </nav>
    );
}
