import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ─── PUT: Actualizar usuario ──────────────────────────────────────────────────
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { userId, email, first_name, last_name, username, role, status, password, groupIds } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Falta el ID del usuario' }, { status: 400 });
        }

        // 1. Actualizar Perfil
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ first_name, last_name, username, role, status })
            .eq('id', userId);

        if (profileError) throw profileError;

        // 2. Actualizar Auth (email y/o contraseña) con service_role
        const authUpdates: any = {};
        if (password && password.trim().length >= 6) authUpdates.password = password.trim();
        if (email && email.trim().length > 0) authUpdates.email = email.trim();

        if (Object.keys(authUpdates).length > 0) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
            if (authError) throw authError;
        }

        // 3. Actualizar Grupos
        if (groupIds && Array.isArray(groupIds)) {
            const { error: delError } = await supabaseAdmin.from('user_groups').delete().eq('user_id', userId);
            if (delError) throw delError;

            if (groupIds.length > 0) {
                const inserts = groupIds.map((gid: string) => ({ user_id: userId, group_id: gid }));
                const { error: groupError } = await supabaseAdmin.from('user_groups').insert(inserts);
                if (groupError) throw groupError;
            }
        }

        return NextResponse.json({ message: 'Usuario actualizado correctamente' });
    } catch (err: any) {
        console.error('Admin PUT Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ─── POST: Crear usuario nuevo ────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, password, first_name, last_name, username, role, status, groupIds } = body;

        if (!email || !password) {
            return NextResponse.json({ error: 'Correo y contraseña son obligatorios' }, { status: 400 });
        }

        // 1. Crear en Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email.trim(),
            password: password.trim(),
            email_confirm: true,
            user_metadata: { first_name, last_name },
        });

        if (authError) throw authError;
        const newUserId = authData.user.id;

        // 2. Upsert perfil (el trigger ya lo crea, pero aseguramos los campos)
        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
            id: newUserId,
            first_name,
            last_name,
            username: username || null,
            role: role || 'user',
            status: status || 'approved',
        }, { onConflict: 'id' });

        if (profileError) throw profileError;

        // 3. Asignar grupos
        if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
            const inserts = groupIds.map((gid: string) => ({ user_id: newUserId, group_id: gid }));
            const { error: groupError } = await supabaseAdmin.from('user_groups').insert(inserts);
            if (groupError) throw groupError;
        }

        return NextResponse.json({ message: 'Usuario creado correctamente', userId: newUserId });
    } catch (err: any) {
        console.error('Admin POST Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ─── DELETE: Eliminar usuario ─────────────────────────────────────────────────
export async function DELETE(req: Request) {
    try {
        const { userId, requesterId, requesterRole } = await req.json();

        if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 });
        if (userId === requesterId) return NextResponse.json({ error: 'No puedes eliminarte a ti mismo' }, { status: 403 });
        if (requesterRole !== 'super_admin') return NextResponse.json({ error: 'Solo el Super Admin puede eliminar usuarios' }, { status: 403 });

        // Verificar que la víctima no sea super_admin
        const { data: victim } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).single();
        if (victim?.role === 'super_admin') {
            return NextResponse.json({ error: 'No es posible eliminar al Super Admin' }, { status: 403 });
        }

        // Eliminar de Auth (en cascada borra el perfil también)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;

        return NextResponse.json({ message: 'Usuario eliminado correctamente' });
    } catch (err: any) {
        console.error('Admin DELETE Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
