'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type PostAction = 'idle' | 'editing';

function ProposalCard({ prop, userProfile, onRefresh }: { prop: any; userProfile: any; onRefresh: () => void }) {
    const [action, setAction] = useState<PostAction>('idle');
    const [editTitle, setEditTitle] = useState(prop.title);
    const [editContent, setEditContent] = useState(prop.content);
    const [saving, setSaving] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);

    const isSuperAdmin = userProfile.role === 'super_admin';
    const isAdmin = ['super_admin', 'admin', 'teacher'].includes(userProfile.role);

    const handleHide = async () => {
        if (!confirm('¿Ocultar esta propuesta?')) return;
        const { error } = await supabase.from('posts').update({ is_published: false }).eq('id', prop.id);
        if (error) alert('Error: ' + error.message);
        else onRefresh();
    };

    const handleDelete = async () => {
        if (!confirm('¿ELIMINAR esta propuesta permanentemente?')) return;
        const { error } = await supabase.from('posts').delete().eq('id', prop.id);
        if (error) alert('Error: ' + error.message);
        else onRefresh();
    };

    const handleSaveEdit = async () => {
        setSaving(true);
        const { error } = await supabase.from('posts').update({ title: editTitle, content: editContent }).eq('id', prop.id);
        setSaving(false);
        if (error) alert('Error: ' + error.message);
        else { setAction('idle'); onRefresh(); }
    };

    const handleVote = async (type: 'up' | 'down') => {
        await supabase.from('proposal_votes').upsert({ post_id: prop.id, user_id: userProfile.id, vote_type: type });
        onRefresh();
    };

    const fetchComments = async () => {
        const { data } = await supabase
            .from('comments')
            .select('*, author:profiles!user_id(first_name, last_name, role)')
            .eq('post_id', prop.id)
            .order('created_at', { ascending: true });
        if (data) setComments(data);
    };

    const handleToggleComments = () => {
        if (!showComments) fetchComments();
        setShowComments(v => !v);
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        setCommentLoading(true);
        const { error } = await supabase.from('comments').insert({ post_id: prop.id, user_id: userProfile.id, content: newComment });
        setCommentLoading(false);
        if (!error) { setNewComment(''); fetchComments(); }
        else alert('Error: ' + error.message);
    };

    const handleHideComment = async (commentId: string) => {
        const { error } = await supabase.from('comments').update({ content: '[Comentario ocultado por moderación]' }).eq('id', commentId);
        if (!error) fetchComments();
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm('¿Eliminar este comentario?')) return;
        const { error } = await supabase.from('comments').delete().eq('id', commentId);
        if (!error) fetchComments();
    };

    const handleReportComment = async (commentId: string) => {
        const reason = prompt('¿Por qué estás denunciando este comentario?');
        if (!reason) return;
        const { error } = await supabase.from('reports').insert({ reporter_id: userProfile.id, comment_id: commentId, reason });
        if (!error) alert('Denuncia enviada. Los administradores lo revisarán.');
        else alert('Error al denunciar: ' + error.message);
    };

    return (
        <article className="glass-card" style={{ padding: '2rem' }}>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div>
                            <span style={proposalBadge}>💡 PROPUESTA · {prop.group?.name}</span>
                            <h3 style={{ marginTop: '0.5rem', color: 'var(--primary)' }}>{prop.title}</h3>
                        </div>
                        <time style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(prop.created_at).toLocaleDateString()}
                        </time>
                    </div>

                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#4a5568', marginBottom: '1.5rem' }}>{prop.content}</p>

                    {/* Acciones */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #edf2f7', paddingTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button onClick={() => handleVote('up')} style={{ ...ghostBtn, color: 'var(--success)', background: prop.myVote === 'up' ? '#dcfce7' : 'transparent' }}>
                                👍 {prop.upVotes}
                            </button>
                            <button onClick={() => handleVote('down')} style={{ ...ghostBtn, color: 'var(--error)', background: prop.myVote === 'down' ? '#fee2e2' : 'transparent' }}>
                                👎 {prop.downVotes}
                            </button>
                            <button onClick={handleToggleComments} style={{ ...ghostBtn, color: 'var(--primary)' }}>
                                💬 {comments.length > 0 ? comments.length : ''} Comentar
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Por: <strong>{prop.author?.first_name}</strong></span>
                            {isAdmin && (
                                <>
                                    <button onClick={() => setAction('editing')} style={{ ...ghostBtn, color: 'var(--primary)' }}>✏️</button>
                                    <button onClick={handleHide} style={{ ...ghostBtn, color: '#d97706' }}>🙈</button>
                                </>
                            )}
                            {isSuperAdmin && (
                                <button onClick={handleDelete} style={{ ...ghostBtn, color: 'var(--error)' }}>🗑️</button>
                            )}
                        </div>
                    </div>

                    {/* Sección de comentarios */}
                    {showComments && (
                        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                            <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--primary)' }}>💬 Debate y Refinamiento</h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                                {comments.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin comentarios aún. ¡Sé el primero!</p>}
                                {comments.map(c => (
                                    <div key={c.id} style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                    {c.author?.first_name} {c.author?.last_name}
                                                </span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                                    {new Date(c.created_at).toLocaleString()}
                                                </span>
                                                <p style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: c.content.startsWith('[Comentario ocultado') ? 'var(--text-muted)' : '#374151', fontStyle: c.content.startsWith('[Comentario ocultado') ? 'italic' : 'normal' }}>
                                                    {c.content}
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                {isSuperAdmin && (
                                                    <button onClick={() => handleDeleteComment(c.id)} style={{ ...tinyBtn, color: 'var(--error)' }}>🗑️</button>
                                                )}
                                                {isAdmin && (
                                                    <button onClick={() => handleHideComment(c.id)} style={{ ...tinyBtn, color: '#d97706' }}>🙈</button>
                                                )}
                                                {!isAdmin && c.user_id !== userProfile.id && (
                                                    <button onClick={() => handleReportComment(c.id)} style={{ ...tinyBtn, color: 'var(--error)' }}>⚑</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Caja para nuevo comentario */}
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                                <textarea
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                    placeholder="Escribe tu aporte o sugerencia..."
                                    style={{ ...inputStyle, flex: 1, minHeight: '60px', resize: 'none' }}
                                    rows={2}
                                />
                                <button onClick={handleAddComment} className="btn-primary" disabled={commentLoading} style={{ padding: '0.65rem 1rem', flexShrink: 0 }}>
                                    {commentLoading ? '...' : 'Enviar'}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </article>
    );
}

export default function ProposalFeed({ userProfile }: { userProfile: any }) {
    const [proposals, setProposals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProposals = async () => {
        setLoading(true);
        try {
            const { data: userGroups } = await supabase.from('user_groups').select('group_id').eq('user_id', userProfile.id);
            const groupIds = userGroups?.map(ug => ug.group_id) || [];

            let query = supabase
                .from('posts')
                .select('*, author:profiles!author_id(first_name, last_name, role), group:groups(name)')
                .eq('type', 'proposal')
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (!['super_admin', 'admin'].includes(userProfile.role)) {
                query = query.in('group_id', groupIds);
            }

            const { data, error } = await query;
            if (error) throw error;

            const withVotes = await Promise.all((data || []).map(async (p) => {
                const { data: votes } = await supabase.from('proposal_votes').select('vote_type, user_id').eq('post_id', p.id);
                const up = votes?.filter(v => v.vote_type === 'up').length || 0;
                const down = votes?.filter(v => v.vote_type === 'down').length || 0;
                const myVote = votes?.find(v => v.user_id === userProfile.id)?.vote_type;
                return { ...p, upVotes: up, downVotes: down, myVote };
            }));

            setProposals(withVotes);
        } catch (error: any) {
            console.error('Error fetching proposals:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProposals(); }, [userProfile.id]);

    if (loading) return <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando propuestas...</p>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {proposals.length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', borderStyle: 'dashed' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Aún no hay propuestas en tus grupos. ¡Sé el primero!</p>
                </div>
            ) : proposals.map(prop => (
                <ProposalCard key={prop.id} prop={prop} userProfile={userProfile} onRefresh={fetchProposals} />
            ))}
        </div>
    );
}

const proposalBadge: React.CSSProperties = { fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' };
const ghostBtn: React.CSSProperties = { background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.3rem 0.7rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' };
const tinyBtn: React.CSSProperties = { background: 'transparent', border: 'none', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', cursor: 'pointer' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' };
