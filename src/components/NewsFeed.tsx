'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function NewsFeed({ userProfile }: { userProfile: any }) {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [readPosts, setReadPosts] = useState<string[]>([]);

    const fetchFeed = async () => {
        setLoading(true);
        try {
            // Obtener noticias de los grupos a los que pertenece el usuario
            const { data: userGroups } = await supabase
                .from('user_groups')
                .select('group_id')
                .eq('user_id', userProfile.id);

            const groupIds = userGroups?.map(ug => ug.group_id) || [];

            let query = supabase
                .from('posts')
                .select(`
                    *,
                    author:profiles!author_id(first_name, last_name, role),
                    group:groups(name)
                `)
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            // Si no es admin/super_admin/teacher, filtrar por sus grupos + Grupo 'General'
            if (!['super_admin', 'admin', 'teacher'].includes(userProfile.role)) {
                const { data: generalGroup } = await supabase
                    .from('groups')
                    .select('id')
                    .eq('name', 'General')
                    .single();

                const allInterestedGroups = generalGroup ? [...groupIds, generalGroup.id] : groupIds;
                query = query.in('group_id', allInterestedGroups);
            }

            const { data, error } = await query;
            if (error) throw error;
            setPosts(data || []);

            // Obtener confirmaciones de lectura del usuario
            const { data: reads } = await supabase
                .from('post_reads')
                .select('post_id')
                .eq('user_id', userProfile.id);

            if (reads) setReadPosts(reads.map(r => r.post_id));

        } catch (error: any) {
            console.error('Error fetching feed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeed();
    }, [userProfile.id]);

    const handleConfirmRead = async (postId: string) => {
        try {
            const { error } = await supabase.from('post_reads').insert({
                post_id: postId,
                user_id: userProfile.id
            });

            if (error) throw error;
            setReadPosts([...readPosts, postId]);
        } catch (error: any) {
            alert('Error al confirmar lectura: ' + error.message);
        }
    };

    if (loading) return <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando noticias...</p>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {posts.length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', borderStyle: 'dashed' }}>
                    <p style={{ color: 'var(--text-muted)' }}>No hay noticias nuevas para tus grupos.</p>
                </div>
            ) : (
                posts.map(post => (
                    <article key={post.id} className="glass-card" style={{ padding: '2rem', borderLeft: readPosts.includes(post.id) ? 'none' : '4px solid var(--accent)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <span style={{
                                    fontSize: '0.75rem',
                                    background: 'var(--accent-glow)',
                                    color: 'var(--primary)',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase'
                                }}>
                                    {post.group?.name}
                                </span>
                                <h3 style={{ marginTop: '0.5rem', color: 'var(--primary)' }}>{post.title}</h3>
                            </div>
                            <time style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {new Date(post.created_at).toLocaleDateString()}
                            </time>
                        </div>

                        <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#4a5568', marginBottom: '1.5rem' }}>
                            {post.content}
                        </p>

                        {post.multimedia_url && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <a
                                    href={post.multimedia_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        color: 'var(--primary)',
                                        fontSize: '0.9rem',
                                        textDecoration: 'none',
                                        fontWeight: 600,
                                        padding: '0.5rem 1rem',
                                        background: '#f1f5f9',
                                        borderRadius: 'var(--radius-sm)'
                                    }}
                                >
                                    📎 Ver archivo adjunto / Link
                                </a>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #edf2f7', paddingTop: '1rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Por: <strong>{post.author?.first_name} {post.author?.last_name}</strong> ({post.author?.role})
                            </span>

                            {readPosts.includes(post.id) ? (
                                <span style={{ color: 'var(--success)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                                    ✓ Enterado
                                </span>
                            ) : (
                                <button
                                    onClick={() => handleConfirmRead(post.id)}
                                    className="btn-primary"
                                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                                >
                                    Marcar como Enterado
                                </button>
                            )}
                        </div>
                    </article>
                )
                ))}
        </div>
    );
}
