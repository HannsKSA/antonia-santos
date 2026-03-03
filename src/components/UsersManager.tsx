'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const emptyForm = {
    email: '',
    first_name: '',
    last_name: '',
    username: '',
    role: 'user',
    status: 'approved',
    password: '',
    groupIds: [] as string[],
};

export default function UsersManager({ userProfile }: { userProfile: any }) {
    const [users, setUsers] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Modal: editar
    const [editingUser, setEditingUser] = useState<any>(null);
    const [editForm, setEditForm] = useState({ ...emptyForm });
    const [updating, setUpdating] = useState(false);

    // Modal: crear
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);

    // Modal: confirmar eliminación
    const [deletingUser, setDeletingUser] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        const { data: usersData, error: uError } = await supabase.rpc('get_users_admin');
        if (uError) {
            console.error('Error fetching users via RPC:', uError);
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('*, user_groups(group_id)')
                .order('last_name', { ascending: true });
            if (profilesData) setUsers(profilesData);
        } else {
            setUsers(usersData || []);
        }
        const { data: groupsData } = await supabase.from('groups').select('*').order('name');
        if (groupsData) setGroups(groupsData);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    // ── Editar ──────────────────────────────────────────────────────────────
    const handleEditOpen = (user: any) => {
        const currentGroupIds = user.groups_info
            ? user.groups_info.map((g: any) => g.group_id)
            : user.user_groups?.map((ug: any) => ug.group_id) || [];
        setEditingUser(user);
        setEditForm({
            email: user.email || '',
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            username: user.username || '',
            role: user.role || 'user',
            status: user.status || 'pending',
            password: '',
            groupIds: currentGroupIds,
        });
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setUpdating(true);
        try {
            const res = await fetch('/api/admin/user', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: editingUser.id, ...editForm }),
            });
            const data = await res.json();
            if (res.ok) {
                alert('✅ Usuario actualizado correctamente');
                setEditingUser(null);
                await fetchData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch {
            alert('Error de red al guardar');
        } finally {
            setUpdating(false);
        }
    };

    // ── Crear ───────────────────────────────────────────────────────────────
    const handleCreateSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createForm.email || !createForm.password) {
            alert('Correo y contraseña son obligatorios');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/admin/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createForm),
            });
            const data = await res.json();
            if (res.ok) {
                alert('✅ Usuario creado correctamente');
                setCreating(false);
                setCreateForm({ ...emptyForm });
                await fetchData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch {
            alert('Error de red al crear usuario');
        } finally {
            setSaving(false);
        }
    };

    // ── Eliminar ────────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!deletingUser) return;
        setDeleting(true);
        try {
            const res = await fetch('/api/admin/user', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: deletingUser.id,
                    requesterId: userProfile.id,
                    requesterRole: userProfile.role,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                alert('🗑️ Usuario eliminado');
                setDeletingUser(null);
                await fetchData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch {
            alert('Error de red al eliminar');
        } finally {
            setDeleting(false);
        }
    };

    const toggleGroup = (groupId: string, form: any, setForm: any) => {
        setForm((prev: any) => {
            const isRemoving = prev.groupIds.includes(groupId);
            if (isRemoving) {
                return {
                    ...prev,
                    groupIds: prev.groupIds.filter((id: string) => id !== groupId),
                };
            } else {
                // Agregar el grupo y todos sus padres recursivamente
                const idsToAdd = new Set<string>();
                let currentId: string | null = groupId;
                while (currentId) {
                    idsToAdd.add(currentId);
                    const group = groups.find(g => g.id === currentId);
                    currentId = group?.parent_id || null;
                }
                return {
                    ...prev,
                    groupIds: [...new Set([...prev.groupIds, ...Array.from(idsToAdd)])],
                };
            }
        });
    };

    const toggleAllGroups = (form: any, setForm: any) => {
        const allIds = groups.map(g => g.id);
        const isAllSelected = form.groupIds.length === groups.length;
        setForm((prev: any) => ({
            ...prev,
            groupIds: isAllSelected ? [] : allIds,
        }));
    };

    const filteredUsers = users.filter(u =>
        `${u.first_name} ${u.last_name} ${u.email || ''} ${u.username || ''}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="glass-card" style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ color: 'var(--primary)' }}>👥 Gestión Total de Usuarios</h3>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => { setCreateForm({ ...emptyForm }); setCreating(true); }}
                        style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                        ➕ Crear Usuario
                    </button>
                    <button onClick={fetchData} className="btn-accent" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>🔄 Refrescar</button>
                    <input
                        type="text"
                        placeholder="Buscar por nombre, correo o usuario..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #ddd', minWidth: '280px' }}
                    />
                </div>
            </div>

            {/* Tabla */}
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
                            {filteredUsers.map(u => {
                                const isSuperAdmin = u.role === 'super_admin';
                                return (
                                    <tr key={u.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{u.username || 'sin_user'}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontSize: '0.85rem' }}>{u.email || <span style={{ color: '#ccc' }}>Sin correo</span>}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{u.role?.toUpperCase()}</div>
                                            <div style={{ fontSize: '0.75rem', color: u.status === 'approved' ? 'var(--success)' : u.status === 'pending' ? '#d97706' : 'var(--error)' }}>
                                                ● {u.status}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {u.groups_info ? (
                                                    u.groups_info.length > 0
                                                        ? u.groups_info.map((g: any) => <span key={g.group_id} style={badgeStyle}>{g.name}</span>)
                                                        : <span style={{ color: '#ccc', fontSize: '0.75rem' }}>Sin grupo</span>
                                                ) : (
                                                    u.user_groups?.length > 0
                                                        ? u.user_groups.map((ug: any) => {
                                                            const g = groups.find((grp: any) => grp.id === ug.group_id);
                                                            return g ? <span key={g.id} style={badgeStyle}>{g.name}</span> : null;
                                                        })
                                                        : <span style={{ color: '#ccc', fontSize: '0.75rem' }}>Sin grupo</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                                <button
                                                    onClick={() => handleEditOpen(u)}
                                                    style={actionBtn}
                                                    title="Editar Usuario"
                                                >
                                                    ✏️
                                                </button>
                                                {!isSuperAdmin && (
                                                    <button
                                                        onClick={() => setDeletingUser(u)}
                                                        style={{ ...actionBtn, color: '#ef4444' }}
                                                        title="Eliminar Usuario"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Modal Editar ──────────────────────────────────────────────── */}
            {editingUser && (
                <div style={overlayStyle}>
                    <div className="glass-card" style={modalStyle}>
                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>✏️ Editar Usuario</h3>
                        <form onSubmit={handleEditSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Correo Electrónico</label>
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
                                    <label style={labelStyle}>Nueva Contraseña (opcional)</label>
                                    <input type="password" placeholder="Mínimo 6 caracteres" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} style={inputStyle} />
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
                            <GroupPicker
                                groups={groups}
                                selectedIds={editForm.groupIds}
                                onToggle={(id) => toggleGroup(id, editForm, setEditForm)}
                                onToggleAll={() => toggleAllGroups(editForm, setEditForm)}
                            />
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" onClick={() => setEditingUser(null)} style={{ ...btnStyle, background: '#cbd5e1', color: '#1e293b' }}>Cancelar</button>
                                <button type="submit" disabled={updating} style={btnStyle}>{updating ? 'Guardando...' : 'Guardar Cambios'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal Crear ───────────────────────────────────────────────── */}
            {creating && (
                <div style={overlayStyle}>
                    <div className="glass-card" style={modalStyle}>
                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>➕ Crear Nuevo Usuario</h3>
                        <form onSubmit={handleCreateSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Correo Electrónico *</label>
                                <input required type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} style={inputStyle} placeholder="correo@ejemplo.com" />
                            </div>
                            <div>
                                <label style={labelStyle}>Contraseña *</label>
                                <input required type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} style={inputStyle} placeholder="Mínimo 6 caracteres" minLength={6} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Nombres</label>
                                    <input type="text" value={createForm.first_name} onChange={e => setCreateForm({ ...createForm, first_name: e.target.value })} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Apellidos</label>
                                    <input type="text" value={createForm.last_name} onChange={e => setCreateForm({ ...createForm, last_name: e.target.value })} style={inputStyle} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Username</label>
                                    <input type="text" value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Rol</label>
                                    <select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })} style={inputStyle}>
                                        <option value="user">Usuario</option>
                                        <option value="teacher">Docente</option>
                                        <option value="admin">Administrador</option>
                                        <option value="super_admin">Super Admin</option>
                                    </select>
                                </div>
                            </div>
                            <GroupPicker
                                groups={groups}
                                selectedIds={createForm.groupIds}
                                onToggle={(id) => toggleGroup(id, createForm, setCreateForm)}
                                onToggleAll={() => toggleAllGroups(createForm, setCreateForm)}
                            />
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" onClick={() => setCreating(false)} style={{ ...btnStyle, background: '#cbd5e1', color: '#1e293b' }}>Cancelar</button>
                                <button type="submit" disabled={saving} style={btnStyle}>{saving ? 'Creando...' : 'Crear Usuario'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal Eliminar ────────────────────────────────────────────── */}
            {deletingUser && (
                <div style={overlayStyle}>
                    <div className="glass-card" style={{ ...modalStyle, maxWidth: '400px', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                        <h3 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Eliminar Usuario</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                            ¿Estás seguro de que deseas eliminar a:
                        </p>
                        <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
                            {deletingUser.first_name} {deletingUser.last_name}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            {deletingUser.email}
                        </p>
                        <p style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                            Esta acción es irreversible. Se eliminarán todos sus datos.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => setDeletingUser(null)} style={{ ...btnStyle, background: '#cbd5e1', color: '#1e293b' }}>Cancelar</button>
                            <button onClick={handleDelete} disabled={deleting} style={{ ...btnStyle, background: '#ef4444' }}>
                                {deleting ? 'Eliminando...' : '🗑️ Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Selector de grupos reutilizable ─────────────────────────────────────────
function GroupPicker({ groups, selectedIds, onToggle, onToggleAll }: {
    groups: any[];
    selectedIds: string[];
    onToggle: (id: string) => void;
    onToggleAll: () => void;
}) {
    const isAllSelected = groups.length > 0 && selectedIds.length === groups.length;

    const buildTree = (nodes: any[], parent: string | null = null): any[] => {
        return nodes
            .filter(node => node.parent_id === parent)
            .map(node => ({
                ...node,
                children: buildTree(nodes, node.id)
            }));
    };

    const tree = buildTree(groups);

    const GroupItem = ({ node, depth }: { node: any, depth: number }) => (
        <div key={node.id}>
            <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                marginLeft: `${depth * 20}px`,
                background: selectedIds.includes(node.id) ? 'rgba(26, 54, 93, 0.05)' : 'transparent',
                transition: 'var(--transition)'
            }}>
                <input type="checkbox" checked={selectedIds.includes(node.id)} onChange={() => onToggle(node.id)} />
                <span style={{ color: depth === 0 ? 'var(--primary)' : 'inherit', fontWeight: depth === 0 ? 600 : 400 }}>
                    {depth > 0 && '↳ '} {node.name}
                </span>
            </label>
            {node.children.map((child: any) => <GroupItem key={child.id} node={child} depth={depth + 1} />)}
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label style={labelStyle}>Asignar Grados / Grupos</label>
                {groups.length > 0 && (
                    <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)', fontWeight: 600 }}>
                        <input type="checkbox" checked={isAllSelected} onChange={onToggleAll} />
                        Seleccionar todos
                    </label>
                )}
            </div>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                maxHeight: '200px',
                overflowY: 'auto',
                padding: '0.75rem',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
            }}>
                {tree.map(node => <GroupItem key={node.id} node={node} depth={0} />)}
                {groups.length === 0 && <span style={{ color: '#ccc', fontSize: '0.75rem' }}>No hay grupos disponibles</span>}
            </div>
        </div>
    );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const badgeStyle: React.CSSProperties = { background: '#ebf4ff', color: '#3182ce', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600 };
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)' };
const modalStyle: React.CSSProperties = { width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', background: 'white' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--primary)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' };
const btnStyle: React.CSSProperties = { flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 600, cursor: 'pointer' };
const actionBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '0.4rem', borderRadius: '6px' };
