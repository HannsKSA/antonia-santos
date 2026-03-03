'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';

export default function Navbar() {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const pathname = usePathname();

    const fetchProfile = async (uid: string) => {
        const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
        setProfile(data);
    };

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user.id);
            setLoading(false);
        };
        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user.id);
            else setProfile(null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Close menu/dropdown when route changes
    useEffect(() => {
        setIsMenuOpen(false);
        setIsDropdownOpen(false);
    }, [pathname]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    };

    const isAuthPage = pathname === '/login' || pathname === '/register';
    const isAdmin = profile && ['super_admin', 'admin', 'teacher'].includes(profile.role);
    const isSuperAdmin = profile && profile.role === 'super_admin';

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
                    style={{ width: '65px', height: 'auto', borderRadius: '4px' }}
                />
                <span className="brand-text" style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem', maxWidth: '150px', lineHeight: 1.2 }}>
                    IE Antonia Santos
                </span>
            </Link>

            {/* Desktop Links */}
            <div className="nav-links" style={{ gap: '2rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <Link href="/" style={{ color: pathname === '/' ? 'var(--primary)' : 'inherit' }}>Inicio</Link>
                <Link href="/noticias" style={{ color: pathname === '/noticias' ? 'var(--primary)' : 'inherit' }}>Noticias</Link>
                <Link href="/dashboard" style={{ color: pathname === '/dashboard' ? 'var(--primary)' : 'inherit' }}>Panel</Link>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {!loading && user && (
                    <NotificationBell userId={user.id} />
                )}
                {!loading && (
                    <div className="nav-actions" style={{ position: 'relative' }}>
                        {user ? (
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="btn-primary"
                                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    Mi Panel {isDropdownOpen ? '▴' : '▾'}
                                </button>

                                {isDropdownOpen && (
                                    <div className="glass-card" style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 0.5rem)',
                                        right: 0,
                                        width: '220px',
                                        padding: '0.75rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.25rem',
                                        zIndex: 110,
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                                    }}>
                                        <Link href="/dashboard" className="dropdown-item">📁 Ver Panel</Link>

                                        {isAdmin && (
                                            <Link href="/dashboard?tab=approvals" className="dropdown-item">🔔 Solicitudes</Link>
                                        )}

                                        {isSuperAdmin && (
                                            <>
                                                <Link href="/dashboard?tab=users_admin" className="dropdown-item">👥 Usuarios</Link>
                                                <Link href="/dashboard?tab=groups_admin" className="dropdown-item">🏗️ Grupos</Link>
                                            </>
                                        )}

                                        <div style={{ height: '1px', background: '#edf2f7', margin: '0.5rem 0' }} />

                                        <button
                                            onClick={handleLogout}
                                            style={{
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '0.6rem 0.75rem',
                                                border: 'none',
                                                background: 'transparent',
                                                color: 'var(--error)',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                borderRadius: '6px'
                                            }}
                                            className="hover-bg"
                                        >
                                            🚪 Cerrar Sesión
                                        </button>
                                    </div>
                                )}
                            </div>
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
                    <Link href="/noticias" style={{ fontWeight: 600, color: pathname === '/noticias' ? 'var(--primary)' : 'var(--text)' }}>Noticias</Link>
                    <Link href="/dashboard" style={{ fontWeight: 600, color: pathname === '/dashboard' ? 'var(--primary)' : 'var(--text)' }}>Panel</Link>

                    {user && (
                        <>
                            <div style={{ height: '1px', background: '#edf2f7', margin: '0.5rem 0' }} />
                            {isAdmin && <Link href="/dashboard?tab=approvals">🔔 Solicitudes</Link>}
                            {isSuperAdmin && (
                                <>
                                    <Link href="/dashboard?tab=users_admin">👥 Usuarios</Link>
                                    <Link href="/dashboard?tab=groups_admin">🏗️ Grupos</Link>
                                </>
                            )}
                            <button
                                onClick={handleLogout}
                                style={{ textAlign: 'left', border: 'none', background: 'none', color: 'var(--error)', fontWeight: 600, fontSize: '1rem' }}
                            >
                                🚪 Cerrar Sesión
                            </button>
                        </>
                    )}
                </div>
            )}
            <style jsx>{`
                .dropdown-item {
                    padding: 0.6rem 0.75rem;
                    border-radius: 6px;
                    text-decoration: none;
                    color: var(--text);
                    font-size: 0.9rem;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .dropdown-item:hover, .hover-bg:hover {
                    background: rgba(0,0,0,0.05);
                }
            `}</style>
        </nav>
    );
}
