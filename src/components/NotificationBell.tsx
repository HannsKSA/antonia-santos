'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function NotificationBell({ userId }: { userId: string }) {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const fetchNotifications = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(25);
        if (data) setNotifications(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchNotifications();

        // Tiempo real: escuchar nuevas notificaciones via Supabase Realtime
        const channel = supabase
            .channel(`notifications:${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`,
            }, (payload) => {
                setNotifications(prev => [payload.new as any, ...prev]);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    // Cerrar panel al hacer clic fuera
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAllRead = async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds);

        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    const handleMarkRead = async (id: string) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Ahora mismo';
        if (mins < 60) return `Hace ${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `Hace ${hrs}h`;
        return `Hace ${Math.floor(hrs / 24)}d`;
    };

    return (
        <div ref={panelRef} style={{ position: 'relative' }}>
            {/* Botón campanita */}
            <button
                onClick={() => { setIsOpen(v => !v); if (!isOpen) fetchNotifications(); }}
                style={{
                    position: 'relative',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: isOpen ? 'rgba(26,54,93,0.1)' : 'transparent',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.1rem',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                }}
                title="Notificaciones"
            >
                🔔
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: 'var(--error)',
                        color: 'white',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid white',
                        animation: unreadCount > 0 ? 'pulse 2s ease-in-out infinite' : 'none',
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Panel desplegable */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    width: '340px',
                    maxHeight: '480px',
                    background: 'rgba(255,255,255,0.97)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.14)',
                    overflow: 'hidden',
                    zIndex: 1000,
                    animation: 'fadeInUp 0.2s ease-out',
                }}>
                    {/* Header del panel */}
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Notificaciones</span>
                            {unreadCount > 0 && (
                                <span style={{ background: 'var(--error)', color: 'white', borderRadius: '20px', padding: '0.1rem 0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>
                                    {unreadCount} nueva{unreadCount !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button onClick={handleMarkAllRead} style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none' }}>
                                Marcar todas leídas
                            </button>
                        )}
                    </div>

                    {/* Lista de notificaciones */}
                    <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
                        {loading && (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cargando...</div>
                        )}
                        {!loading && notifications.length === 0 && (
                            <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔕</div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Sin notificaciones aún</p>
                            </div>
                        )}
                        {notifications.map(n => (
                            <Link
                                key={n.id}
                                href={n.link || '/dashboard'}
                                onClick={() => { handleMarkRead(n.id); setIsOpen(false); }}
                                style={{
                                    display: 'flex',
                                    gap: '0.75rem',
                                    padding: '0.85rem 1.25rem',
                                    borderBottom: '1px solid #f8fafc',
                                    background: n.is_read ? 'transparent' : 'rgba(26,54,93,0.04)',
                                    transition: 'background 0.15s ease',
                                    textDecoration: 'none',
                                    alignItems: 'flex-start',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                                onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(26,54,93,0.04)')}
                            >
                                {/* Indicador de no leído */}
                                <div style={{ marginTop: '5px', flexShrink: 0 }}>
                                    {!n.is_read ? (
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
                                    ) : (
                                        <div style={{ width: '8px', height: '8px' }} />
                                    )}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: '0.85rem', fontWeight: n.is_read ? 400 : 600, color: 'var(--text)', lineHeight: 1.4, marginBottom: '0.2rem' }}>
                                        {n.title}
                                    </p>
                                    {n.body && (
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {n.body}
                                        </p>
                                    )}
                                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                        {timeAgo(n.created_at)}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
