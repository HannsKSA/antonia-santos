'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CreateProposal({ userProfile, onCreated }: { userProfile: any, onCreated: () => void }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [groupId, setGroupId] = useState('');
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function fetchMyGroups() {
            // Usuarios solo pueden proponer en sus propios grupos
            const { data: myGroups } = await supabase
                .from('user_groups')
                .select('group_id, groups(name)')
                .eq('user_id', userProfile.id);

            if (myGroups) {
                const formatted = myGroups.map((mg: any) => ({
                    id: mg.group_id,
                    name: mg.groups.name
                }));
                setGroups(formatted);
                if (formatted.length > 0) setGroupId(formatted[0].id);
            }
        }
        fetchMyGroups();
    }, [userProfile.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.from('posts').insert({
                author_id: userProfile.id,
                type: 'proposal',
                title,
                content,
                group_id: groupId,
                is_published: true, // Por defecto lanzamos la propuesta al grupo
            });

            if (error) throw error;

            setTitle('');
            setContent('');
            alert('¡Propuesta enviada con éxito! Ahora tu comunidad podrá debatirla.');
            onCreated();
        } catch (error: any) {
            alert('Error al enviar propuesta: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💡 Lanzar una Propuesta
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Comparte una idea para mejorar tu grado o la institución. Los demás podrán votar y comentar.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                    <label style={labelStyle}>Resumen de la idea</label>
                    <input
                        type="text"
                        required
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        style={inputStyle}
                        placeholder="Ej: Techo para el patio central"
                    />
                </div>

                <div className="form-group">
                    <label style={labelStyle}>Explicación detallada</label>
                    <textarea
                        required
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                        placeholder="Describe cómo se realizaría y por qué es importante..."
                    />
                </div>

                <div className="form-group">
                    <label style={labelStyle}>¿A qué grupo va dirigida?</label>
                    <select
                        value={groupId}
                        onChange={e => setGroupId(e.target.value)}
                        style={inputStyle}
                    >
                        {groups.length === 0 ? (
                            <option disabled>No perteneces a ningún grupo técnico aún</option>
                        ) : (
                            groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))
                        )}
                    </select>
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading || groups.length === 0}
                    style={{ marginTop: '0.5rem', width: 'fit-content' }}
                >
                    {loading ? 'Enviando...' : 'Publicar Propuesta'}
                </button>
            </form>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    marginBottom: '0.4rem',
    color: 'var(--primary)',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(255,255,255,0.5)',
    fontSize: '0.9rem',
    outline: 'none',
};
