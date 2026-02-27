'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
    const [role, setRole] = useState<'representative' | 'student' | 'teacher'>('representative');
    const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [representedName, setRepresentedName] = useState('');

    useEffect(() => {
        async function fetchGroups() {
            const { data } = await supabase.from('groups').select('*').order('name');
            if (data) setGroups(data);
        }
        fetchGroups();
    }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            // 1. Auth Signup
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('Error al crear el usuario');

            // 2. Create Profile (The trigger usually handles this, but we update it with extra info)
            // Note: schema_initial.sql has a profiles table. 
            // We might need to wait for the trigger or do an upsert.
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    phone,
                    sub_role: role,
                    represented_name: representedName,
                    status: 'pending'
                })
                .eq('id', authData.user.id);

            if (profileError) throw profileError;

            // 3. Add to groups
            if (selectedGroups.length > 0) {
                const groupInserts = selectedGroups.map(groupId => ({
                    user_id: authData.user!.id,
                    group_id: groupId
                }));
                const { error: groupError } = await supabase.from('user_groups').insert(groupInserts);
                if (groupError) throw groupError;
            }

            setMessage({ type: 'success', text: 'Registro exitoso. Tu cuenta está pendiente de aprobación por un docente.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Error en el registro' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Crear Cuenta</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                    Únete a la comunidad de la IE Antonia Santos
                </p>

                {message && (
                    <div style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius)',
                        marginBottom: '1.5rem',
                        backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: message.type === 'success' ? 'var(--success)' : 'var(--error)',
                        border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
                        fontSize: '0.9rem'
                    }}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label style={labelStyle}>Nombre</label>
                            <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} placeholder="Ej: Juan" />
                        </div>
                        <div className="form-group">
                            <label style={labelStyle}>Apellido</label>
                            <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} placeholder="Ej: Pérez" />
                        </div>
                    </div>

                    <div className="form-group">
                        <label style={labelStyle}>Correo Electrónico</label>
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="tu@email.com" />
                    </div>

                    <div className="form-group">
                        <label style={labelStyle}>Contraseña</label>
                        <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" minLength={6} />
                    </div>

                    <div className="form-group">
                        <label style={labelStyle}>Teléfono / Celular</label>
                        <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="300 000 0000" />
                    </div>

                    <div className="form-group">
                        <label style={labelStyle}>Soy...</label>
                        <select value={role} onChange={e => setRole(e.target.value as any)} style={inputStyle}>
                            <option value="representative">Representante / Padre de Familia</option>
                            <option value="student">Estudiante</option>
                            <option value="teacher">Docente</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label style={labelStyle}>
                            {role === 'representative' ? 'Nombre del Estudiante (Representado)' :
                                role === 'student' ? 'Tu Grado' : 'Grado que lideras'}
                        </label>
                        <input
                            type="text"
                            required
                            value={representedName}
                            onChange={e => setRepresentedName(e.target.value)}
                            style={inputStyle}
                            placeholder={role === 'representative' ? "Ej: Carlos Pérez" : "Ej: Grado 5-1"}
                        />
                    </div>

                    <div className="form-group">
                        <label style={labelStyle}>Selecciona tu grado(s)</label>
                        <div style={{
                            maxHeight: '120px',
                            overflowY: 'auto',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem'
                        }}>
                            {groups.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>
                                    Cargando grados o sin conexión...
                                </p>
                            ) : (
                                groups.map(group => (
                                    <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedGroups.includes(group.id)}
                                            onChange={e => {
                                                if (e.target.checked) setSelectedGroups([...selectedGroups, group.id]);
                                                else setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                                            }}
                                        />
                                        {group.name}
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
                        {loading ? 'Procesando...' : 'Solicitar Acceso'}
                    </button>

                    <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        ¿Ya tienes cuenta? <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Inicia Sesión</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
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
    transition: 'border-color 0.2s',
};
