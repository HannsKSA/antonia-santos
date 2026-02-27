'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CreatePoll({ userProfile, onPollCreated }: { userProfile: any, onPollCreated: () => void }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [groupId, setGroupId] = useState('');
    const [groups, setGroups] = useState<any[]>([]);
    const [options, setOptions] = useState<string[]>(['', '']);
    const [loading, setLoading] = useState(false);

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

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const addOption = () => {
        if (options.length < 5) {
            setOptions([...options, '']);
        }
    };

    const removeOption = (index: number) => {
        if (options.length > 2) {
            setOptions(options.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validOptions = options.filter(opt => opt.trim() !== '');

        if (validOptions.length < 2) {
            alert('Debes incluir al menos 2 opciones');
            return;
        }

        setLoading(true);

        try {
            // 1. Create the post
            const { data: post, error: postError } = await supabase.from('posts').insert({
                author_id: userProfile.id,
                type: 'survey',
                title,
                content,
                group_id: groupId,
                is_published: true
            }).select().single();

            if (postError) throw postError;

            // 2. Create the options
            const pollOptions = validOptions.map(opt => ({
                post_id: post.id,
                option_text: opt
            }));

            const { error: optionsError } = await supabase.from('poll_options').insert(pollOptions);
            if (optionsError) throw optionsError;

            setTitle('');
            setContent('');
            setOptions(['', '']);
            alert('Encuesta publicada con éxito');
            onPollCreated();
        } catch (error: any) {
            alert('Error al publicar encuesta: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>📊 Crear Nueva Encuesta</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                    <label style={labelStyle}>Pregunta o Título</label>
                    <input
                        type="text"
                        required
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        style={inputStyle}
                        placeholder="Ej: ¿Qué día prefieren para la entrega de informes?"
                    />
                </div>

                <div className="form-group">
                    <label style={labelStyle}>Descripción (Opcional)</label>
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                        placeholder="Explica el contexto de la encuesta..."
                    />
                </div>

                <div className="form-group">
                    <label style={labelStyle}>Opciones de Respuesta</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {options.map((opt, index) => (
                            <div key={index} style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    required
                                    value={opt}
                                    onChange={e => handleOptionChange(index, e.target.value)}
                                    style={inputStyle}
                                    placeholder={`Opción ${index + 1}`}
                                />
                                {options.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() => removeOption(index)}
                                        style={{ background: 'transparent', color: 'var(--error)', cursor: 'pointer', fontSize: '1.2rem' }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    {options.length < 5 && (
                        <button
                            type="button"
                            onClick={addOption}
                            style={{
                                marginTop: '0.75rem',
                                background: 'transparent',
                                border: '1px dashed var(--primary)',
                                color: 'var(--primary)',
                                padding: '0.4rem 1rem',
                                borderRadius: '4px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                            }}
                        >
                            + Agregar Opción
                        </button>
                    )}
                </div>

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

                <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                    style={{ marginTop: '0.5rem', width: 'fit-content', padding: '0.75rem 2rem' }}
                >
                    {loading ? 'Publicando...' : 'Publicar Encuesta'}
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
