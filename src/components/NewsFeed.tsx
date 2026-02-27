'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type PostAction = 'idle' | 'editing';
type NewsFilter = 'visible' | 'hidden' | 'all';

function MediaCarousel({ media }: { media: any[] }) {
    if (!media || media.length === 0) return null;

    return (
        <div style={{
            display: 'flex',
            gap: '1rem',
            overflowX: 'auto',
            padding: '1rem 0',
            scrollbarWidth: 'thin',
            msOverflowStyle: 'none'
        }}>
            {media.map((item, idx) => (
                <div key={idx} style={{ flexShrink: 0, width: '100%', maxWidth: '450px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {item.type === 'video' ? (
                        <video
                            controls
                            src={item.url}
                            style={{ width: '100%', height: 'auto', display: 'block' }}
                        />
                    ) : (
                        <img
                            src={item.url}
                            alt={`Media ${idx}`}
                            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
                            onClick={() => window.open(item.url, '_blank')}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

function PostCard({ post, userProfile, onRefresh }: { post: any; userProfile?: any; onRefresh: () => void }) {
    const [action, setAction] = useState<PostAction>('idle');
    const [editTitle, setEditTitle] = useState(post.title);
    const [editContent, setEditContent] = useState(post.content);
    const [saving, setSaving] = useState(false);
    const [liking, setLiking] = useState(false);

    const isAdmin = userProfile && ['super_admin', 'admin', 'teacher'].includes(userProfile.role);
    const isSuperAdmin = userProfile && userProfile.role === 'super_admin';
    const isOwner = userProfile && userProfile.id === post.author_id;

    const handleHide = async () => {
        if (!confirm('¿Ocultar esta noticia?')) return;
        const { error } = await supabase.from('posts').update({ is_published: false }).eq('id', post.id);
        if (error) alert('Error: ' + error.message);
        else onRefresh();
    };

    const handleRestore = async () => {
        const { error } = await supabase.from('posts').update({ is_published: true }).eq('id', post.id);
        if (error) alert('Error: ' + error.message);
        else onRefresh();
    };

    const handleDelete = async () => {
        if (!confirm('¿ELIMINAR permanentemente esta noticia?')) return;
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

    const handleLike = async () => {
        if (!userProfile || liking) return;
        setLiking(true);
        try {
            if (post.isLiked) {
                await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', userProfile.id);
            } else {
                await supabase.from('post_likes').insert({ post_id: post.id, user_id: userProfile.id });
            }
            onRefresh();
        } catch (e) {
            console.error(e);
        } finally {
            setLiking(false);
        }
    };

    const isHidden = !post.is_published;
    const mediaItems = post.media || (post.multimedia_url ? [{ url: post.multimedia_url, type: post.multimedia_url.match(/\.(mp4|webm|ogg|mov)$/i) ? 'video' : 'image' }] : []);

    return (
        <article className="glass-card" style={{
            padding: isHidden ? '1rem 2rem' : '2rem',
            borderLeft: isHidden ? '4px solid #94a3b8' : (post.is_public ? '4px solid #3b82f6' : '4px solid var(--accent)'),
            opacity: isHidden ? 0.8 : 1,
            position: 'relative'
        }}>
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
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {isHidden && <span style={{ ...badgeStyle, background: '#f1f5f9', color: '#64748b' }}>🙈 OCULTA</span>}
                                {post.is_public && <span style={{ ...badgeStyle, background: '#dbeafe', color: '#1e40af' }}>🌍 PÚBLICA</span>}
                                <span style={badgeStyle}>{post.group?.name || 'General'}</span>
                            </div>
                            <h3 style={{ marginTop: '0.5rem', color: isHidden ? '#64748b' : 'var(--primary)' }}>{post.title}</h3>
                        </div>
                        <time style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(post.created_at).toLocaleDateString()}
                        </time>
                    </div>

                    {!isHidden && (
                        <>
                            <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#4a5568', marginTop: '1rem', marginBottom: '1.5rem' }}>{post.content}</p>
                            <MediaCarousel media={mediaItems} />
                        </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #edf2f7', paddingTop: '1rem', marginTop: isHidden ? '0.5rem' : '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Por: <strong>{post.author?.first_name} {post.author?.last_name}</strong>
                            </span>
                            {!isHidden && (
                                <button onClick={handleLike} disabled={!userProfile || liking} style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: userProfile ? 'pointer' : 'default',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    color: post.isLiked ? 'var(--error)' : 'var(--text-muted)',
                                    fontWeight: 600,
                                    fontSize: '0.9rem'
                                }}>
                                    {post.isLiked ? '❤️' : '🤍'} {post.likesCount || 0}
                                </button>
                            )}
                        </div>

                        {(isAdmin || isOwner) && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {isHidden ? (
                                    <button onClick={handleRestore} style={{ ...ghostBtn, color: 'var(--success)' }}>👁️ Visualizar</button>
                                ) : (
                                    <>
                                        <button onClick={() => setAction('editing')} style={{ ...ghostBtn, color: 'var(--primary)' }}>✏️ Editar</button>
                                        <button onClick={handleHide} style={{ ...ghostBtn, color: '#d97706' }}>🙈 Ocultar</button>
                                    </>
                                )}
                                {(isSuperAdmin || (isOwner && isHidden)) && (
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

export default function NewsFeed({ userProfile, onlyPublic = false }: { userProfile?: any; onlyPublic?: boolean }) {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [readPosts, setReadPosts] = useState<string[]>([]);
    const [filter, setFilter] = useState<NewsFilter>('visible');

    const fetchFeed = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('posts')
                .select('*, author:profiles!author_id(first_name, last_name, role), group:groups(name)')
                .eq('type', 'news')
                .order('created_at', { ascending: false });

            // Base visibility
            if (onlyPublic || !userProfile) {
                query = query.eq('is_public', true).eq('is_published', true);
            } else {
                const isAdmin = ['super_admin', 'admin', 'teacher'].includes(userProfile.role);
                const myId = userProfile.id;

                if (!isAdmin) {
                    // Regular user: can only see published news from their groups or public + their own hidden/draft
                    const { data: userGroups } = await supabase.from('user_groups').select('group_id').eq('user_id', myId);
                    const groupIds = userGroups?.map(ug => ug.group_id) || [];
                    const { data: generalGroup } = await supabase.from('groups').select('id').eq('name', 'General').single();
                    const allGroups = generalGroup ? [...groupIds, generalGroup.id] : groupIds;
                    const groupsFilter = allGroups.length > 0 ? allGroups.join(',') : '00000000-0000-0000-0000-000000000000';

                    query = query.or(`and(is_published.eq.true,or(is_public.eq.true,group_id.in.(${groupsFilter}))),author_id.eq.${myId}`);
                } else {
                    // Admins/Teachers
                    if (filter === 'visible') {
                        // All published institutional news + my own hidden ones
                        query = query.or(`is_published.eq.true,author_id.eq.${myId}`);
                    } else if (filter === 'hidden') {
                        // Only hidden ones I wrote
                        query = query.eq('is_published', false).eq('author_id', myId);
                    } else {
                        // 'all'
                        // can see everything (RLS will still limit if not super_admin, but usually admins see all)
                    }
                }
            }

            const { data, error } = await query;
            if (error) throw error;

            // Fetch likes and reads
            const postsWithInteractions = await Promise.all((data || []).map(async (p) => {
                const { count: likesCount } = await supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id);
                let isLiked = false;
                if (userProfile) {
                    const { data: myLike } = await supabase.from('post_likes').select('*').eq('post_id', p.id).eq('user_id', userProfile.id).single();
                    isLiked = !!myLike;
                }
                return { ...p, likesCount, isLiked };
            }));

            setPosts(postsWithInteractions);

            if (userProfile) {
                const { data: reads } = await supabase.from('post_reads').select('post_id').eq('user_id', userProfile.id);
                if (reads) setReadPosts(reads.map(r => r.post_id));
            }
        } catch (error: any) {
            console.error('Error fetching feed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchFeed(); }, [userProfile?.id, onlyPublic, filter]);

    const handleConfirmRead = async (postId: string) => {
        if (!userProfile) return;
        const { error } = await supabase.from('post_reads').insert({ post_id: postId, user_id: userProfile.id });
        if (!error) setReadPosts([...readPosts, postId]);
    };

    if (loading) return <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando noticias...</p>;

    const isAdmin = userProfile && ['super_admin', 'admin', 'teacher'].includes(userProfile.role);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {isAdmin && !onlyPublic && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as NewsFilter)}
                        style={{ ...inputStyle, width: 'auto', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    >
                        <option value="visible">Mostrar: Visibles</option>
                        <option value="hidden">Mostrar: Ocultas</option>
                        <option value="all">Mostrar: Todas</option>
                    </select>
                </div>
            )}

            {posts.length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', borderStyle: 'dashed' }}>
                    <p style={{ color: 'var(--text-muted)' }}>No hay noticias disponibles por el momento.</p>
                </div>
            ) : posts.map(post => {
                if (isAdmin) {
                    return <PostCard key={post.id} post={post} userProfile={userProfile} onRefresh={fetchFeed} />;
                }

                return (
                    <PostCard key={post.id} post={post} userProfile={userProfile} onRefresh={fetchFeed} />
                );
            })}
        </div>
    );
}

const badgeStyle: React.CSSProperties = { fontSize: '0.75rem', background: 'var(--accent-glow)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' };
const ghostBtn: React.CSSProperties = { background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.3rem 0.7rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', outline: 'none' };
