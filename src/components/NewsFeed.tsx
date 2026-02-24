'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type PostAction = 'idle' | 'editing';

function PostCard({ post, userProfile, onRefresh }: { post: any; userProfile: any; onRefresh: () => void }) {
    const [action, setAction] = useState<PostAction>('idle');
    const [editTitle, setEditTitle] = useState(post.title);
    const [editContent, setEditContent] = useState(post.content);
    const [saving, setSaving] = useState(false);

    const isSuperAdmin = userProfile.role === 'super_admin';
    const isAdmin = ['super_admin', 'admin', 'teacher'].includes(userProfile.role);

    const handleHide = async () => {
        if (!confirm('¿Ocultar esta noticia?')) return;
        const { error } = await supabase.from('posts').update({ is_published: false }).eq('id', post.id);
        if (error) alert('Error: ' + error.message);
        else onRefresh();
    };

    const handleDelete = async () => {
        if (!confirm('¿ELIMINAR permanentemente esta noticia? Esta acción no se puede deshacer.')) return;
        const { error } = await supabase.from('posts').delete().eq('id', post.id);
        if (error) alert('Error: ' + error.message);
        else onRefresh();
    };

    const handleSaveEdit = async () => {
        setSaving(true);
        const { error } = await supabase.from('posts').update({ title: editTitle, content: editContent }).eq('id', post.id);
        setSaving(false);
        if (error) alert('Error: ' + error.message);
        else { setAction('idle'); onRefresh(); }
    };

    return (
        <article className="glass-card" style={{ padding: '2rem', borderLeft: '4px solid var(--accent)', position: 'relative' }}>
            {action === 'editing' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={inputStyle} />
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleSaveEdit} className="btn-primary" disabled={saving} style={{ padding: '0.4rem 1rem' }}>{saving ? 'Guardando...' : '✓ Guardar'}</button>
                        <button onClick={() => setAction('idle')} style={{ ...ghostBtn, color: 'var(--text-muted)' }}>Cancelar</button>
                    </div>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div>
                            <span style={badgeStyle}>{post.group?.name}</span>
                            <h3 style={{ marginTop: '0.5rem', color: 'var(--primary)' }}>{post.title}</h3>
                        </div>
                        <time style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(post.created_at).toLocaleDateString()}
                        </time>
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#4a5568', marginTop: '1rem', marginBottom: '1.5rem' }}>{post.content}</p>
                    {post.multimedia_url && (
                        <a href={post.multimedia_url} target="_blank" rel="noopener noreferrer" style={linkStyle}>📎 Ver archivo / Link</a>
                    )}

                    {/* Barra de acciones */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #edf2f7', paddingTop: '1rem', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Por: <strong>{post.author?.first_name} {post.author?.last_name}</strong>
                        </span>
                        {isAdmin && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button onClick={() => setAction('editing')} style={{ ...ghostBtn, color: 'var(--primary)' }}>✏️ Editar</button>
                                <button onClick={handleHide} style={{ ...ghostBtn, color: '#d97706' }}>🙈 Ocultar</button>
                                {isSuperAdmin && (
                                    <button onClick={handleDelete} style={{ ...ghostBtn, color: 'var(--error)' }}>🗑️ Eliminar</button>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </article>
    );
}

export default function NewsFeed({ userProfile }: { userProfile: any }) {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [readPosts, setReadPosts] = useState<string[]>([]);

    const fetchFeed = async () => {
        setLoading(true);
        try {
            const { data: userGroups } = await supabase.from('user_groups').select('group_id').eq('user_id', userProfile.id);
            const groupIds = userGroups?.map(ug => ug.group_id) || [];

            let query = supabase
                .from('posts')
                .select('*, author:profiles!author_id(first_name, last_name, role), group:groups(name)')
                .eq('type', 'news')
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (!['super_admin', 'admin', 'teacher'].includes(userProfile.role)) {
                const { data: generalGroup } = await supabase.from('groups').select('id').eq('name', 'General').single();
                const allGroups = generalGroup ? [...groupIds, generalGroup.id] : groupIds;
                query = query.in('group_id', allGroups);
            }

            const { data, error } = await query;
            if (error) throw error;
            setPosts(data || []);

            const { data: reads } = await supabase.from('post_reads').select('post_id').eq('user_id', userProfile.id);
            if (reads) setReadPosts(reads.map(r => r.post_id));
        } catch (error: any) {
            console.error('Error fetching feed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchFeed(); }, [userProfile.id]);

    const handleConfirmRead = async (postId: string) => {
        const { error } = await supabase.from('post_reads').insert({ post_id: postId, user_id: userProfile.id });
        if (!error) setReadPosts([...readPosts, postId]);
    };

    if (loading) return <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando noticias...</p>;

    const isAdmin = ['super_admin', 'admin', 'teacher'].includes(userProfile.role);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {posts.length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', borderStyle: 'dashed' }}>
                    <p style={{ color: 'var(--text-muted)' }}>No hay noticias nuevas para tus grupos.</p>
                </div>
            ) : posts.map(post => (
                isAdmin ? (
                    <PostCard key={post.id} post={post} userProfile={userProfile} onRefresh={fetchFeed} />
                ) : (
                    <article key={post.id} className="glass-card" style={{ padding: '2rem', borderLeft: readPosts.includes(post.id) ? 'none' : '4px solid var(--accent)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <span style={badgeStyle}>{post.group?.name}</span>
                                <h3 style={{ marginTop: '0.5rem', color: 'var(--primary)' }}>{post.title}</h3>
                            </div>
                            <time style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(post.created_at).toLocaleDateString()}</time>
                        </div>
                        <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#4a5568', margin: '1rem 0 1.5rem' }}>{post.content}</p>
                        {post.multimedia_url && <a href={post.multimedia_url} target="_blank" rel="noopener noreferrer" style={linkStyle}>📎 Ver archivo / Link</a>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #edf2f7', paddingTop: '1rem', marginTop: '1rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Por: <strong>{post.author?.first_name} {post.author?.last_name}</strong></span>
                            {readPosts.includes(post.id) ? (
                                <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Enterado</span>
                            ) : (
                                <button onClick={() => handleConfirmRead(post.id)} className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
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

const badgeStyle: React.CSSProperties = { fontSize: '0.75rem', background: 'var(--accent-glow)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' };
const linkStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 600, padding: '0.4rem 0.8rem', background: '#f1f5f9', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' };
const ghostBtn: React.CSSProperties = { background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.3rem 0.7rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', outline: 'none' };
