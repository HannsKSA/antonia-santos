'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function GroupsManager() {
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newGroupName, setNewGroupName] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchGroups = async () => {
        setLoading(true);
        const { data } = await supabase.from('groups').select('*').order('name');
        if (data) setGroups(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        setCreating(true);
        const { error } = await supabase.from('groups').insert({ name: newGroupName.trim() });
        setCreating(false);
        if (error) alert(error.message);
        else {
            setNewGroupName('');
            fetchGroups();
        }
    };

    const handleDeleteGroup = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar el grupo "${name}"? Esto afectará a los usuarios y noticias asociados.`)) return;
        const { error } = await supabase.from('groups').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchGroups();
    };

    return (
        <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ color: 'var(--primary)', marginBottom: '1.5rem' }}>🏗️ Gestión de Grados y Grupos</h3>

            <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                <input
                    type="text"
                    placeholder="Nombre del nuevo grupo (Ej: Grado 2-1)"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                    style={{ ...inputStyle, flex: 1 }}
                />
                <button type="submit" className="btn-primary" disabled={creating}>
                    {creating ? 'Creando...' : '＋ Crear Grupo'}
                </button>
            </form>

            {loading ? <p>Cargando grupos...</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                    {groups.map(g => (
                        <div key={g.id} style={{
                            padding: '1rem',
                            background: 'white',
                            borderRadius: '10px',
                            border: '1px solid #edf2f7',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                            <span style={{ fontWeight: 600 }}>{g.name}</span>
                            <button
                                onClick={() => handleDeleteGroup(g.id, g.name)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '1.1rem' }}
                                title="Eliminar grupo"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const inputStyle = {
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    outline: 'none',
    fontSize: '0.9rem'
};
