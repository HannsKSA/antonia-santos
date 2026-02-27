'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function UsersManager({ userProfile }: { userProfile: any }) {
    const [users, setUsers] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Edit Modal State
    const [editingUser, setEditingUser] = useState<any>(null);
    const [editForm, setEditForm] = useState({
        email: '',
        first_name: '',
        last_name: '',
        username: '',
        role: '',
        status: '',
        password: '',
        groupIds: [] as string[]
    });
    const [updating, setUpdating] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        // Usamos RPC para evitar errores de cache de esquema con la columna email
        // Esta función hace el JOIN con auth.users de forma segura
        const { data: usersData, error: uError } = await supabase.rpc('get_users_admin');

        if (uError) {
            console.error("Error fetching users via RPC:", uError);
            // Fallback por si el RPC falla (aunque no debería)
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('*, user_groups(group_id)')
                .order('last_name', { ascending: true });
            if (profilesData) setUsers(profilesData);
        } else {
            setUsers(usersData || []);
        }

        // Fetch Groups (solo para el selector)
        const { data: groupsData } = await supabase.from('groups').select('*').order('name');
        if (groupsData) setGroups(groupsData);

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleEditOpen = (user: any) => {
        setEditingUser(user);

        // Mapear groupIds ya sea del RPC (groups_info) o del fallback (user_groups)
        const currentGroupIds = user.groups_info
            ? user.groups_info.map((g: any) => g.group_id)
            : user.user_groups?.map((ug: any) => ug.group_id) || [];

        setEditForm({
            email: user.email || '',
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            username: user.username || '',
            role: user.role || '',
            status: user.status || '',
            password: '',
            groupIds: currentGroupIds
        });
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setUpdating(true);
        try {
            const res = await fetch('/api/admin/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: editingUser.id, ...editForm })
            });

            const data = await res.json();
            if (res.ok) {
                alert('Usuario actualizado correctamente');
                setEditingUser(null);
                await fetchData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (err: any) {
            alert('Error de red');
        } finally {
            setUpdating(false);
        }
    };

    const toggleGroup = (groupId: string) => {
        setEditForm(prev => ({
            ...prev,
            groupIds: prev.groupIds.includes(groupId)
                ? prev.groupIds.filter(id => id !== groupId)
                : [...prev.groupIds, groupId]
        }));
    };

    const filteredUsers = users.filter(u =>
        `${u.first_name} ${u.last_name} ${u.email || ''} ${u.username || ''}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="glass-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ color: 'var(--primary)' }}>👥 Gestión Total de Usuarios</h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button onClick={fetchData} className="btn-accent" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>🔄 Refrescar</button>
                    <input
                        type="text"
                        placeholder="Buscar por nombre, correo o usuario..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #ddd', minWidth: '350px' }}
                    />
                </div>
            </div>

            {loading ? <p>Cargando información...</p> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #edf2f7' }}>
                                <th style={{ padding: '1rem' }}>Usuario / Nombre</th>
                                <th style={{ padding: '1rem' }}>Correo Electrónico</th>
                                <th style={{ padding: '1rem' }}>Rol / Estado</th>
                                <th style={{ padding: '1rem' }}>Grados/Grupos</th>
                                <th style={{ padding: '1rem' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{u.username || 'sin_user'}</div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.85rem' }}>{u.email || <span style={{ color: '#ccc' }}>Sin correo</span>}</div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{u.role.toUpperCase()}</div>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: u.status === 'approved' ? 'var(--success)' : u.status === 'pending' ? '#d97706' : 'var(--error)'
                                        }}>
                                            ● {u.status}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {u.groups_info ? (
                                                u.groups_info.length > 0 ? u.groups_info.map((g: any) => (
                                                    <span key={g.group_id} style={badgeStyle}>{g.name}</span>
                                                )) : <span style={{ color: '#ccc', fontSize: '0.75rem' }}>Estandar</span>
                                            ) : (
                                                u.user_groups?.length > 0 ? u.user_groups.map((ug: any) => {
                                                    const g = groups.find(grp => grp.id === ug.group_id);
                                                    return g ? <span key={g.id} style={badgeStyle}>{g.name}</span> : null;
                                                }) : <span style={{ color: '#ccc', fontSize: '0.75rem' }}>Estandar</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <button
                                            onClick={() => handleEditOpen(u)}
                                            style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }}
                                            title="Editar Usuario"
                                        >
                                            ✏️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            {editingUser && (
                <div style={modalOverlayStyle}>
                    <div className="glass-card" style={modalContentStyle}>
                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Editar Usuario</h3>

                        <form onSubmit={handleEditSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Correo Electrónico (Auth)</label>
                                <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={inputStyle} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Nombres</label>
                                    <input type="text" value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Apellidos</label>
                                    <input type="text" value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} style={inputStyle} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Username</label>
                                    <input type="text" value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Nueva Clave (opcional)</label>
                                    <input type="password" placeholder="Mínimo 6 caracteres" onChange={e => setEditForm({ ...editForm, password: e.target.value })} style={inputStyle} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Rol</label>
                                    <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} style={inputStyle}>
                                        <option value="user">Usuario</option>
                                        <option value="teacher">Docente</option>
                                        <option value="admin">Administrador</option>
                                        <option value="super_admin">Super Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Estado</label>
                                    <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} style={inputStyle}>
                                        <option value="approved">Aprobado</option>
                                        <option value="pending">Pendiente</option>
                                        <option value="rejected">Rechazado</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Asignar Grados / Grupos</label>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                    gap: '0.5rem',
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                    padding: '1rem',
                                    background: '#f8fafc',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0'
                                }}>
                                    {groups.map(g => (
                                        <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={editForm.groupIds.includes(g.id)}
                                                onChange={() => toggleGroup(g.id)}
                                            />
                                            {g.name}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setEditingUser(null)} style={{ ...btnStyle, background: '#cbd5e1', color: '#1e293b' }}>Cancelar</button>
                                <button type="submit" disabled={updating} style={btnStyle}>{updating ? 'Guardando...' : 'Guardar Cambios'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const badgeStyle: React.CSSProperties = {
    background: '#ebf4ff',
    color: '#3182ce',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: 600
};

const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem'
};

const modalContentStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '2rem',
    background: 'white'
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    marginBottom: '0.3rem',
    color: 'var(--primary)'
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.85rem'
};

const btnStyle: React.CSSProperties = {
    flex: 1,
    padding: '0.75rem',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--primary)',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer'
};
