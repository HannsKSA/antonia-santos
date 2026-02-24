'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ProposalFeed({ userProfile }: { userProfile: any }) {
    const [proposals, setProposals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProposals = async () => {
        setLoading(true);
        try {
            // Obtener propuestas de los grupos del usuario o generales
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
                .eq('type', 'proposal')
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (!['super_admin', 'admin'].includes(userProfile.role)) {
                query = query.in('group_id', groupIds);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Para cada propuesta, obtener conteo de votos
            const proposalsWithVotes = await Promise.all((data || []).map(async (p) => {
                const { data: votes } = await supabase
                    .from('proposal_votes')
                    .select('vote_type')
                    .eq('post_id', p.id);

                const up = votes?.filter(v => v.vote_type === 'up').length || 0;
                const down = votes?.filter(v => v.vote_type === 'down').length || 0;

                // Saber si el usuario actual ya votó
                const { data: myVote } = await supabase
                    .from('proposal_votes')
                    .select('vote_type')
                    .eq('post_id', p.id)
                    .eq('user_id', userProfile.id)
                    .single();

                return { ...p, upVotes: up, downVotes: down, myVote: myVote?.vote_type };
            }));

            setProposals(proposalsWithVotes);
        } catch (error: any) {
            console.error('Error fetching proposals:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProposals();
    }, [userProfile.id]);

    const handleVote = async (postId: string, type: 'up' | 'down') => {
        try {
            const { error } = await supabase
                .from('proposal_votes')
                .upsert({
                    post_id: postId,
                    user_id: userProfile.id,
                    vote_type: type
                });

            if (error) throw error;
            fetchProposals(); // Recargar para ver el cambio
        } catch (error: any) {
            alert('Error al votar: ' + error.message);
        }
    };

    if (loading) return <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando propuestas...</p>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {proposals.length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', borderStyle: 'dashed' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Aún no hay propuestas en tus grupos. ¡Sé el primero!</p>
                </div>
            ) : (
                proposals.map(prop => (
                    <article key={prop.id} className="glass-card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <span style={{
                                    fontSize: '0.7rem',
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase'
                                }}>
                                    💡 PROPUESTA: {prop.group?.name}
                                </span>
                                <h3 style={{ marginTop: '0.5rem', color: 'var(--primary)' }}>{prop.title}</h3>
                            </div>
                            <time style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {new Date(prop.created_at).toLocaleDateString()}
                            </time>
                        </div>

                        <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#4a5568', marginBottom: '1.5rem' }}>
                            {prop.content}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #edf2f7', paddingTop: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <button
                                        onClick={() => handleVote(prop.id, 'up')}
                                        style={{
                                            background: prop.myVote === 'up' ? 'var(--success)' : '#ecfdf5',
                                            color: prop.myVote === 'up' ? 'white' : 'var(--success)',
                                            border: '1px solid var(--success)',
                                            padding: '0.3rem 0.7rem',
                                            borderRadius: '6px',
                                            fontWeight: 600,
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        👍 {prop.upVotes}
                                    </button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <button
                                        onClick={() => handleVote(prop.id, 'down')}
                                        style={{
                                            background: prop.myVote === 'down' ? 'var(--error)' : '#fef2f2',
                                            color: prop.myVote === 'down' ? 'white' : 'var(--error)',
                                            border: '1px solid var(--error)',
                                            padding: '0.3rem 0.7rem',
                                            borderRadius: '6px',
                                            fontWeight: 600,
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        👎 {prop.downVotes}
                                    </button>
                                </div>
                            </div>

                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Propuesto por: <strong>{prop.author?.first_name}</strong>
                            </span>
                        </div>
                    </article>
                )
                ))}
        </div>
    );
}
