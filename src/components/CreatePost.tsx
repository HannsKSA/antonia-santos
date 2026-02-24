'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CreatePost({ userProfile, onPostCreated }: { userProfile: any, onPostCreated: () => void }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [groupId, setGroupId] = useState('');
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [multimediaUrl, setMultimediaUrl] = useState('');

    useEffect(() => {
        async function fetchGroups() {
            const { data } = await supabase.from('groups').select('*').order('name');
            if (data) {
                setGroups(data);
                if (data.length > 0) setGroupId(data[0].id);
            }
        }
        fetchGroups();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.from('posts').insert({
                author_id: userProfile.id,
                type: 'news',
                title,
                content,
                group_id: groupId,
                multimedia_url: multimediaUrl,
                is_published: true
            });

            if (error) throw error;

            setTitle('');
            setContent('');
            setMultimediaUrl('');
            alert('Noticia publicada con éxito');
            onPostCreated();
        } catch (error: any) {
            alert('Error al publicar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>📢 Crear Nueva Noticia</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                    <label style={labelStyle}>Título de la Noticia</label>
                    <input
                        type="text"
                        required
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        style={inputStyle}
                        placeholder="Ej: Reunión Extraordinaria"
                    />
                </div>

                <div className="form-group">
                    <label style={labelStyle}>Contenido</label>
                    <textarea
                        required
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
                        placeholder="Escribe aquí el detalle de la noticia..."
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label style={labelStyle}>Grado / Grupo Destino</label>
                        <select
                            value={groupId}
                            onChange={e => setGroupId(e.target.value)}
                            style={inputStyle}
                        >
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label style={labelStyle}>Link Multimedia (Opcional)</label>
                        <input
                            type="text"
                            value={multimediaUrl}
                            onChange={e => setMultimediaUrl(e.target.value)}
                            style={inputStyle}
                            placeholder="Drive, YouTube, etc."
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                    style={{ marginTop: '0.5rem', width: 'fit-content', padding: '0.75rem 2rem' }}
                >
                    {loading ? 'Publicando...' : 'Publicar Noticia'}
                </button>
            </form>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
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
