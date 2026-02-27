'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

function PollCard({ poll, userProfile, onRefresh }: { poll: any; userProfile: any; onRefresh: () => void }) {
    const [voting, setVoting] = useState(false);
    const [myVote, setMyVote] = useState<string | null>(poll.myVoteId);

    const isAdmin = ['super_admin', 'admin', 'teacher'].includes(userProfile.role);

    const handleVote = async (optionId: string) => {
        if (myVote === optionId) return;
        setVoting(true);
        try {
            // Upsert vote
            const { error } = await supabase.from('votes').upsert({
                user_id: userProfile.id,
                post_id: poll.id,
                option_id: optionId
            });

            if (error) throw error;
            setMyVote(optionId);
            onRefresh();
        } catch (error: any) {
            alert('Error al votar: ' + error.message);
        } finally {
            setVoting(false);
        }
    };

    const totalVotes = poll.options.reduce((acc: number, opt: any) => acc + (opt.votes_count || 0), 0);

    return (
        <article className="glass-card" style={{ padding: '2rem', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                    <span style={pollBadge}>📊 ENCUESTA · {poll.group?.name}</span>
                    <h3 style={{ marginTop: '0.5rem', color: 'var(--primary)' }}>{poll.title}</h3>
                    {poll.content && <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{poll.content}</p>}
                </div>
                <time style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(poll.created_at).toLocaleDateString()}
                </time>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                {poll.options.map((opt: any) => {
                    const voteCount = opt.votes_count || 0;
                    const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                    const isSelected = myVote === opt.id;

                    return (
                        <div key={opt.id} style={{ position: 'relative' }}>
                            <button
                                onClick={() => handleVote(opt.id)}
                                disabled={voting}
                                style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '1rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: isSelected ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                                    background: 'transparent',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    zIndex: 1
                                }}
                            >
                                <span style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--primary)' : 'var(--text)' }}>
                                    {opt.option_text}
                                    {isSelected && <span style={{ marginLeft: '0.5rem' }}>✓</span>}
                                </span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                    {percentage}% ({voteCount})
                                </span>

                                {/* Progress bar background */}
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    height: '100%',
                                    width: `${percentage}%`,
                                    background: isSelected ? 'rgba(26, 54, 93, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                                    zIndex: -1,
                                    transition: 'width 0.6s ease'
                                }} />
                            </button>
                        </div>
                    );
                })}
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Total: <strong>{totalVotes} votos</strong>
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Por: <strong>{poll.author?.first_name}</strong>
                </span>
            </div>
        </article>
    );
}

export default function PollFeed({ userProfile }: { userProfile: any }) {
    const [polls, setPolls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPolls = async () => {
        setLoading(true);
        try {
            const { data: userGroups } = await supabase.from('user_groups').select('group_id').eq('user_id', userProfile.id);
            const groupIds = userGroups?.map(ug => ug.group_id) || [];

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
                // Fetch options
                const { data: opts } = await supabase.from('poll_options').select('*').eq('post_id', p.id);
                // Fetch votes for this poll
                const { data: votes } = await supabase.from('votes').select('*').eq('post_id', p.id);

                const myVote = votes?.find(v => v.user_id === userProfile.id);

                const optionsWithCounts = opts?.map(o => ({
                    ...o,
                    votes_count: votes?.filter(v => v.option_id === o.id).length || 0
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

const pollBadge: React.CSSProperties = { fontSize: '0.7rem', background: '#e0e7ff', color: '#4338ca', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' };
