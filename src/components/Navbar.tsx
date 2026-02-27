'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';

export default function Navbar() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
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

    // Close menu when route changes
    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

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
            padding: '0.75rem 1.5rem',
            gap: '1rem'
        }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', flexShrink: 0 }}>
                <img
                    src="/logo.png"
                    alt="Logo IE Antonia Santos"
                    style={{ width: '40px', height: 'auto', borderRadius: '4px' }}
                />
                <span className="brand-text" style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem', maxWidth: '150px', lineHeight: 1.2 }}>
                    IE Antonia Santos
                </span>
            </Link>

            {/* Desktop Links */}
            <div className="nav-links" style={{ gap: '2rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <Link href="/" style={{ color: pathname === '/' ? 'var(--primary)' : 'inherit' }}>Inicio</Link>
                <Link href="/dashboard" style={{ color: pathname === '/dashboard' ? 'var(--primary)' : 'inherit' }}>Noticias</Link>
                <Link href="/dashboard" style={{ color: pathname === '/dashboard' ? 'var(--primary)' : 'inherit' }}>Propuestas</Link>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {!loading && user && (
                    <NotificationBell userId={user.id} />
                )}
                {!loading && (
                    <div className="nav-actions">
                        {user ? (
                            <Link href="/dashboard" className="btn-primary" style={{ padding: '0.55rem 1.1rem', fontSize: '0.9rem' }}>Mi Panel</Link>
                        ) : (
                            !isAuthPage && <Link href="/login" className="btn-primary" style={{ padding: '0.55rem 1.1rem', fontSize: '0.9rem' }}>Ingresar</Link>
                        )}
                    </div>
                )}

                {/* Mobile Menu Toggle */}
                <button
                    className="mobile-toggle"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    style={{ color: 'var(--primary)', padding: '0.4rem' }}
                >
                    {isMenuOpen ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    )}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="mobile-menu glass-card" style={{
                    position: 'absolute',
                    top: 'calc(100% + 0.5rem)',
                    left: 0,
                    right: 0,
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    zIndex: 99,
                    animation: 'fadeInUp 0.3s ease-out'
                }}>
                    <Link href="/" style={{ fontWeight: 600, color: pathname === '/' ? 'var(--primary)' : 'var(--text)' }}>Inicio</Link>
                    <Link href="/dashboard" style={{ fontWeight: 600, color: pathname === '/dashboard' ? 'var(--primary)' : 'var(--text)' }}>Noticias</Link>
                    <Link href="/dashboard" style={{ fontWeight: 600, color: pathname === '/dashboard' ? 'var(--primary)' : 'var(--text)' }}>Propuestas</Link>
                </div>
            )}
        </nav>
    );
}
