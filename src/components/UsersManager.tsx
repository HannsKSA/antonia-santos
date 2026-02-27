'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function UsersManager({ userProfile }: { userProfile: any }) {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .order('last_name', { ascending: true });
        if (data) setUsers(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleRoleChange = async (userId: string, newRole: string) => {
        const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
        if (error) alert(error.message);
        else fetchUsers();
    };

    const handleStatusChange = async (userId: string, newStatus: string) => {
        const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userId);
        if (error) alert(error.message);
        else fetchUsers();
    };

    const filteredUsers = users.filter(u =>
        `${u.first_name} ${u.last_name} ${u.email || ''} ${u.username || ''}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="glass-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ color: 'var(--primary)' }}>👥 Gestión de Usuarios</h3>
                <input
                    type="text"
                    placeholder="Buscar usuario..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #ddd', minWidth: '250px' }}
                />
            </div>

            {loading ? <p>Cargando usuarios...</p> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #edf2f7' }}>
                                <th style={{ padding: '1rem' }}>Nombre</th>
                                <th style={{ padding: '1rem' }}>Rol</th>
                                <th style={{ padding: '1rem' }}>Estado</th>
                                <th style={{ padding: '1rem' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.username || 'Sin username'}</div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                            style={selectStyle}
                                            disabled={u.id === userProfile.id && u.role === 'super_admin'}
                                        >
                                            <option value="super_admin">Super Admin</option>
                                            <option value="admin">Administrador</option>
                                            <option value="teacher">Docente</option>
                                            <option value="user">Usuario</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <select
                                            value={u.status}
                                            onChange={(e) => handleStatusChange(u.id, e.target.value)}
                                            style={{
                                                ...selectStyle,
                                                color: u.status === 'approved' ? 'var(--success)' : u.status === 'pending' ? '#d97706' : 'var(--error)',
                                                fontWeight: 700
                                            }}
                                        >
                                            <option value="approved">Aprobado</option>
                                            <option value="pending">Pendiente</option>
                                            <option value="rejected">Rechazado</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <button
                                            onClick={() => { if (confirm('¿Eliminar este usuario?')) alert('Función no implementada por seguridad. Use "Rechazado" para quitar acceso.'); }}
                                            style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                                            title="Eliminar"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

const selectStyle = {
    padding: '0.4rem',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    background: 'white',
    fontSize: '0.85rem',
    outline: 'none',
    cursor: 'pointer'
};
