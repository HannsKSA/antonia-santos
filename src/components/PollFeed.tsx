'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// ─── Modal de Confirmación ───────────────────────────────────────────────────
function ConfirmModal({
    optionText,
    onConfirm,
    onCancel,
}: {
    optionText: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div style={overlay}>
            <div style={modalBox}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🗳️</div>
                <h3 style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--primary)', fontSize: '1.1rem' }}>
                    ¿Confirmas tu voto?
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    Has seleccionado:
                </p>
                <p style={{
                    background: 'rgba(99,102,241,0.08)',
                    borderRadius: '8px',
                    padding: '0.6rem 1rem',
                    fontWeight: 700,
                    color: 'var(--primary)',
                    marginBottom: '1.25rem',
                    fontSize: '0.95rem',
                }}>
                    &ldquo;{optionText}&rdquo;
                </p>
                <p style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600, marginBottom: '1.5rem' }}>
                    ⚠️ Esta acción es irreversible. Solo puedes votar una vez.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                    <button
                        onClick={onCancel}
                        style={cancelBtn}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        style={confirmBtn}
                    >
                        Sí, confirmar voto
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Tarjeta de Encuesta ─────────────────────────────────────────────────────
function PollCard({ poll, userProfile, onRefresh }: { poll: any; userProfile: any; onRefresh: () => void }) {
    const [voting, setVoting] = useState(false);
    const [myVote, setMyVote] = useState<string | null>(poll.myVoteId);
    const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
    const [pendingOptionText, setPendingOptionText] = useState('');

    const hasVoted = !!myVote;

    const openConfirm = (optionId: string, optionText: string) => {
        if (hasVoted || voting) return;
        setPendingOptionId(optionId);
        setPendingOptionText(optionText);
    };

    const handleConfirm = async () => {
        if (!pendingOptionId) return;
        setVoting(true);
        setPendingOptionId(null);
        try {
            const { error } = await supabase.from('votes').insert({
                user_id: userProfile.id,
                post_id: poll.id,
                option_id: pendingOptionId,
            });
            if (error) throw error;
            setMyVote(pendingOptionId);
            onRefresh();
        } catch (error: any) {
            alert('Error al votar: ' + error.message);
        } finally {
            setVoting(false);
        }
    };

    const handleCancel = () => {
        setPendingOptionId(null);
        setPendingOptionText('');
    };

    const handleClose = async () => {
        if (!confirm('¿Cerrar esta encuesta? Nadie más podrá votar.')) return;
        try {
            const { error } = await supabase.from('posts').update({ is_closed: true }).eq('id', poll.id);
            if (error) throw error;
            onRefresh();
        } catch (error: any) {
            alert('Error al cerrar: ' + error.message);
        }
    };

    const totalVotes = poll.options.reduce((acc: number, opt: any) => acc + (opt.votes_count || 0), 0);

    const handleDelete = async () => {
        if (!confirm('¿ELIMINAR permanentemente esta encuesta y todos sus votos?')) return;
        try {
            const { error } = await supabase.from('posts').delete().eq('id', poll.id);
            if (error) throw error;
            onRefresh();
        } catch (error: any) {
            alert('Error al eliminar: ' + error.message);
        }
    };

    const isSuperAdmin = userProfile?.role === 'super_admin';

    return (
        <>
            {pendingOptionId && (
                <ConfirmModal
                    optionText={pendingOptionText}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            )}

            <article className="glass-card" style={{ padding: '2rem', borderLeft: '4px solid #8b5cf6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={pollBadge}>📊 ENCUESTA · {poll.group?.name}</span>
                            {poll.is_closed && <span style={{ ...pollBadge, background: '#fee2e2', color: '#ef4444' }}>🔒 CERRADA</span>}
                        </div>
                        <h3 style={{ marginTop: '0.5rem', color: 'var(--primary)' }}>{poll.title}</h3>
                        {poll.content && <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{poll.content}</p>}
                    </div>
                    <time style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(poll.created_at).toLocaleDateString()}
                    </time>
                </div>

                {/* Aviso antes de votar */}
                {!hasVoted && (
                    <p style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        👁️ Los resultados se mostrarán después de votar
                    </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                    {poll.options.map((opt: any) => {
                        const voteCount = opt.votes_count || 0;
                        const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                        const isSelected = myVote === opt.id;

                        return (
                            <div key={opt.id} style={{ position: 'relative' }}>
                                <button
                                    onClick={() => openConfirm(opt.id, opt.option_text)}
                                    disabled={hasVoted || voting || poll.is_closed}
                                    title={poll.is_closed ? 'Esta encuesta está cerrada' : (hasVoted ? 'Ya has votado' : '')}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '1rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: isSelected
                                            ? '2px solid var(--primary)'
                                            : '1px solid #e2e8f0',
                                        background: 'transparent',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        cursor: hasVoted ? 'default' : 'pointer',
                                        transition: 'all 0.2s ease',
                                        zIndex: 1,
                                        opacity: hasVoted && !isSelected ? 0.75 : 1,
                                    }}
                                >
                                    <span style={{
                                        fontWeight: isSelected ? 700 : 500,
                                        color: isSelected ? 'var(--primary)' : 'var(--text)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                    }}>
                                        {isSelected && <span>✓</span>}
                                        {opt.option_text}
                                    </span>

                                    {/* Resultados solo si ya votó */}
                                    {hasVoted && (
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isSelected ? 'var(--primary)' : 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                                            {percentage}% ({voteCount})
                                        </span>
                                    )}

                                    {/* Barra de progreso solo si ya votó */}
                                    {hasVoted && (
                                        <div style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 0,
                                            height: '100%',
                                            width: `${percentage}%`,
                                            background: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(0,0,0,0.03)',
                                            zIndex: -1,
                                            transition: 'width 0.6s ease',
                                            borderRadius: 'var(--radius-sm)',
                                        }} />
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                    {hasVoted || poll.is_closed ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Total: <strong>{totalVotes} votos</strong>
                            {poll.is_closed && <span style={{ marginLeft: '0.5rem' }}>(Finalizado)</span>}
                        </span>
                    ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Selecciona una opción para votar
                        </span>
                    )}
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span>Por: <strong>{poll.author?.first_name}</strong></span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {((userProfile?.id === poll.author_id && ['admin', 'teacher'].includes(userProfile?.role)) || userProfile?.role === 'super_admin') && !poll.is_closed && (
                                <button
                                    onClick={handleClose}
                                    style={actionIconBtn}
                                    title="Cerrar encuesta"
                                >
                                    🔒
                                </button>
                            )}
                            {isSuperAdmin && (
                                <button
                                    onClick={handleDelete}
                                    style={actionIconBtn}
                                    title="Eliminar encuesta"
                                >
                                    🗑️
                                </button>
                            )}
                        </div>
                    </span>
                </div>
            </article>
        </>
    );
}

// ─── Feed Principal ───────────────────────────────────────────────────────────
export default function PollFeed({ userProfile }: { userProfile: any }) {
    const [polls, setPolls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPolls = async () => {
        setLoading(true);
        try {
            const { data: userGroups } = await supabase.from('user_groups').select('group_id').eq('user_id', userProfile.id);
            const groupIds = userGroups?.map((ug: any) => ug.group_id) || [];

            let query = supabase
                .from('posts')
                .select('*, author:profiles!author_id(first_name, last_name), group:groups(name)')
                .eq('type', 'survey')
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (!['super_admin', 'admin'].includes(userProfile.role)) {
                query = query.in('group_id', groupIds);
            }

            const { data, error } = await query;
            if (error) throw error;

            const withDetails = await Promise.all((data || []).map(async (p) => {
                const { data: opts } = await supabase.from('poll_options').select('*').eq('post_id', p.id);
                const { data: votes } = await supabase.from('votes').select('*').eq('post_id', p.id);

                const myVote = votes?.find((v: any) => v.user_id === userProfile.id);

                const optionsWithCounts = opts?.map((o: any) => ({
                    ...o,
                    votes_count: votes?.filter((v: any) => v.option_id === o.id).length || 0,
                })) || [];

                return { ...p, options: optionsWithCounts, myVoteId: myVote?.option_id };
            }));

            setPolls(withDetails);
        } catch (error: any) {
            console.error('Error fetching polls:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPolls(); }, [userProfile.id]);

    if (loading) return <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando encuestas...</p>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {polls.length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', borderStyle: 'dashed' }}>
                    <p style={{ color: 'var(--text-muted)' }}>No hay encuestas activas en tus grados.</p>
                </div>
            ) : polls.map(poll => (
                <PollCard key={poll.id} poll={poll} userProfile={userProfile} onRefresh={fetchPolls} />
            ))}
        </div>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const actionIconBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0.2rem',
    borderRadius: '4px',
    transition: 'background 0.2s',
};

const pollBadge: React.CSSProperties = {
    fontSize: '0.7rem',
    background: '#e0e7ff',
    color: '#4338ca',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontWeight: 700,
    textTransform: 'uppercase',
};

const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(4px)',
};

const modalBox: React.CSSProperties = {
    background: '#fff',
    borderRadius: '16px',
    padding: '2rem',
    maxWidth: '380px',
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    animation: 'fadeInUp 0.25s ease',
};

const cancelBtn: React.CSSProperties = {
    padding: '0.65rem 1.4rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: 'transparent',
    cursor: 'pointer',
    fontWeight: 600,
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
};

const confirmBtn: React.CSSProperties = {
    padding: '0.65rem 1.4rem',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.9rem',
};
