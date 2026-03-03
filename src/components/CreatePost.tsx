'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CreatePost({ userProfile, onPostCreated }: { userProfile: any, onPostCreated: () => void }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [groupId, setGroupId] = useState('');
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isPublic, setIsPublic] = useState(false);
    const [mediaLinks, setMediaLinks] = useState<string[]>(['']);

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

    const handleAddMedia = () => setMediaLinks([...mediaLinks, '']);
    const handleMediaChange = (index: number, val: string) => {
        const updated = [...mediaLinks];
        updated[index] = val;
        setMediaLinks(updated);
    };
    const handleRemoveMedia = (index: number) => {
        if (mediaLinks.length > 1) {
            setMediaLinks(mediaLinks.filter((_, i) => i !== index));
        } else {
            setMediaLinks(['']);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const validMedia = mediaLinks.filter(link => link.trim() !== '');

        try {
            const { error } = await supabase.from('posts').insert({
                author_id: userProfile.id,
                type: 'news',
                title,
                content,
                group_id: isPublic ? null : groupId,
                is_public: isPublic,
                media: validMedia.map(url => ({
                    url,
                    type: url.match(/\.(mp4|webm|ogg|mov)$/i) ? 'video' : 'image'
                })),
                multimedia_url: validMedia[0] || '', // Compatible with old code
                is_published: true
            });

            if (error) throw error;

            setTitle('');
            setContent('');
            setMediaLinks(['']);
            setIsPublic(false);
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                    <div className="form-group">
                        <label style={labelStyle}>Grado / Grupo Destino</label>
                        <select
                            value={groupId}
                            onChange={e => setGroupId(e.target.value)}
                            style={inputStyle}
                            disabled={isPublic}
                        >
                            {(() => {
                                const buildFlatTree = (nodes: any[], parent: string | null = null, depth: number = 0): any[] => {
                                    let result: any[] = [];
                                    nodes.filter(n => n.parent_id === parent).forEach(n => {
                                        result.push({ ...n, displayName: '\u00A0\u00A0'.repeat(depth * 2) + (depth > 0 ? '↳ ' : '') + n.name });
                                        result = result.concat(buildFlatTree(nodes, n.id, depth + 1));
                                    });
                                    return result;
                                };
                                return buildFlatTree(groups).map(g => (
                                    <option key={g.id} value={g.id}>{g.displayName}</option>
                                ));
                            })()}
                        </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.75rem' }}>
                        <input
                            type="checkbox"
                            id="isPublic"
                            checked={isPublic}
                            onChange={e => setIsPublic(e.target.checked)}
                            style={{ width: '1.2rem', height: '1.2rem' }}
                        />
                        <label htmlFor="isPublic" style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>
                            🌍 Hacer noticia pública (Visible sin login)
                        </label>
                    </div>
                </div>

                <div className="form-group">
                    <label style={labelStyle}>Multimedia (Imágenes o Videos)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {mediaLinks.map((link, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={link}
                                    onChange={e => handleMediaChange(idx, e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }}
                                    placeholder="URL de imagen o video (mp4, webm, jpg, png...)"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveMedia(idx)}
                                    style={{ background: '#fee2e2', color: 'var(--error)', border: 'none', borderRadius: '4px', padding: '0 0.75rem', cursor: 'pointer' }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={handleAddMedia}
                        style={{ marginTop: '0.5rem', background: 'transparent', border: '1px dashed var(--primary)', color: 'var(--primary)', padding: '0.3rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                        + Agregar otro link
                    </button>
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                    style={{ marginTop: '1rem', width: 'fit-content', padding: '0.75rem 2.5rem' }}
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
