import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, email, first_name, last_name, username, role, status, password, groupIds } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Falta el ID del usuario' }, { status: 400 });
        }

        // 1. Actualizar Perfil
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ email, first_name, last_name, username, role, status })
            .eq('id', userId);

        if (profileError) throw profileError;

        // 2. Actualizar Auth (si viene password o email)
        const authUpdates: any = {};
        if (password) authUpdates.password = password;
        if (email) authUpdates.email = email;

        if (Object.keys(authUpdates).length > 0) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
            if (authError) throw authError;
        }

        // 3. Actualizar Grupos (SI vienen)
        if (groupIds && Array.isArray(groupIds)) {
            // Eliminar actuales relacionados
            const { error: delError } = await supabaseAdmin.from('user_groups').delete().eq('user_id', userId);
            if (delError) throw delError;

            // Insertar nuevos
            if (groupIds.length > 0) {
                const inserts = groupIds.map(gid => ({ user_id: userId, group_id: gid }));
                const { error: groupError } = await supabaseAdmin.from('user_groups').insert(inserts);
                if (groupError) throw groupError;
            }
        }

        return NextResponse.json({ message: 'Usuario actualizado correctamente' });
    } catch (err: any) {
        console.error('Admin API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
