'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Group {
    id: string;
    name: string;
    parent_id: string | null;
    created_at: string;
}

interface GroupNode extends Group {
    children: GroupNode[];
}

export default function GroupsManager() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [tree, setTree] = useState<GroupNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [newGroupName, setNewGroupName] = useState('');
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [parentId, setParentId] = useState<string | null>(null);

    const fetchGroups = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('groups').select('*').order('name');
        if (error) {
            console.error(error);
        } else if (data) {
            setGroups(data);
            const buildTree = (nodes: Group[], parent: string | null = null): GroupNode[] => {
                return nodes
                    .filter(node => node.parent_id === parent)
                    .map(node => ({
                        ...node,
                        children: buildTree(nodes, node.id)
                    }));
            };
            setTree(buildTree(data));
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        setCreating(true);
        const { error } = await supabase.from('groups').insert({
            name: newGroupName.trim(),
            parent_id: parentId
        });
        setCreating(false);
        if (error) alert(error.message);
        else {
            setNewGroupName('');
            setParentId(null);
            fetchGroups();
        }
    };

    const handleDeleteGroup = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar el grupo "${name}"? Se eliminarán también sus subgrupos.`)) return;
        const { error } = await supabase.from('groups').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchGroups();
    };

    const handleUpdateGroup = async (id: string) => {
        if (!editName.trim()) return;
        const { error } = await supabase.from('groups').update({ name: editName.trim() }).eq('id', id);
        if (error) alert(error.message);
        else {
            setEditingId(null);
            fetchGroups();
        }
    };

    const GroupItem = ({ node, depth }: { node: GroupNode, depth: number }) => (
        <div key={node.id} style={{
            marginLeft: `${depth * 24}px`,
            borderLeft: depth > 0 ? '2px solid #e2e8f0' : 'none',
            paddingLeft: depth > 0 ? '16px' : '0',
            marginBottom: '0.5rem',
            position: 'relative'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '0.75rem 1rem',
                background: 'white',
                borderRadius: '10px',
                border: '1px solid #edf2f7',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                transition: 'var(--transition)'
            }}>
                {editingId === node.id ? (
                    <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                        <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{ ...inputStyle, flex: 1 }}
                            autoFocus
                        />
                        <button onClick={() => handleUpdateGroup(node.id)} className="btn-primary" style={{ padding: '0.4rem 0.8rem', minHeight: 'unset' }}>💾</button>
                        <button onClick={() => setEditingId(null)} className="btn-accent" style={{ padding: '0.4rem 0.8rem', minHeight: 'unset', background: '#cbd5e1' }}>❌</button>
                    </div>
                ) : (
                    <>
                        <span style={{ fontSize: '1.2rem' }}>{node.children.length > 0 ? '📁' : '📄'}</span>
                        <span style={{ fontWeight: 600, flex: 1, color: 'var(--primary)' }}>{node.name}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                                onClick={() => {
                                    setParentId(node.id);
                                    setNewGroupName('');
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                    setTimeout(() => document.getElementById('new-group-input')?.focus(), 300);
                                }}
                                style={iconBtnStyle}
                                title="Añadir subgrupo"
                            >
                                ➕
                            </button>
                            <button
                                onClick={() => {
                                    setEditingId(node.id);
                                    setEditName(node.name);
                                }}
                                style={iconBtnStyle}
                                title="Editar"
                            >
                                ✏️
                            </button>
                            <button
                                onClick={() => handleDeleteGroup(node.id, node.name)}
                                style={{ ...iconBtnStyle, color: 'var(--error)' }}
                                title="Eliminar"
                            >
                                🗑️
                            </button>
                        </div>
                    </>
                )}
            </div>
            {node.children.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                    {node.children.map(child => <GroupItem key={child.id} node={child} depth={depth + 1} />)}
                </div>
            )}
        </div>
    );

    return (
        <div className="glass-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ margin: 0 }}>🏗️ Gestión de Grados y Grupos</h3>
                {parentId && (
                    <button onClick={() => setParentId(null)} className="btn-accent" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                        ⬅️ Volver a nivel principal
                    </button>
                )}
            </div>

            <form onSubmit={handleCreateGroup} style={{
                marginBottom: '2.5rem',
                background: parentId ? 'rgba(212, 175, 55, 0.05)' : '#f8fafc',
                padding: '1.5rem',
                borderRadius: '12px',
                border: `2px ${parentId ? 'dashed var(--accent)' : 'solid #e2e8f0'}`,
                transition: 'var(--transition)'
            }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--primary)' }}>
                    {parentId ? `CREAR SUBGRUPO EN: ${groups.find(g => g.id === parentId)?.name.toUpperCase()}` : 'CREAR GRUPO DE PRIMER NIVEL'}
                </label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input
                        id="new-group-input"
                        type="text"
                        placeholder="Nombre (Ej: Grado 1, 1-1, Docentes...)"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        required
                        style={{ ...inputStyle, flex: 1 }}
                    />
                    <button type="submit" className="btn-primary" disabled={creating}>
                        {creating ? 'Creando...' : '＋ Crear Grupo'}
                    </button>
                </div>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', opacity: 0.6, fontSize: '0.9rem' }}>
                <div style={{ width: '20px', height: '2px', background: '#e2e8f0' }}></div>
                <span>Estructura de Grupos</span>
            </div>

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="skeleton" style={{ height: '50px', marginBottom: '1rem' }}></div>
                    <div className="skeleton" style={{ height: '50px', marginBottom: '1rem', marginLeft: '2rem' }}></div>
                    <div className="skeleton" style={{ height: '50px' }}></div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {tree.map(node => <GroupItem key={node.id} node={node} depth={0} />)}
                    {tree.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '12px', color: '#64748b' }}>
                            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📂</span>
                            No hay grupos creados todavía. <br /> Comienza creando uno arriba.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const inputStyle = {
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    outline: 'none',
    fontSize: '0.95rem',
    background: 'white',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)'
};

const iconBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
    borderRadius: '8px',
    transition: 'var(--transition)',
    color: '#64748b'
};
