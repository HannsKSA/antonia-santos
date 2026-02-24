import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
        const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            return new Response(JSON.stringify({ error: 'Faltan credenciales INITIAL_ADMIN en el .env' }), { status: 400 });
        }

        console.log('🚀 Iniciando Setup Antonia Santos...');

        // 1. Crear el usuario en Auth si no existe
        // Nota: El método signUp creará el usuario. Si ya existe, devolverá un error que manejaremos.
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: adminEmail,
            password: adminPassword,
            options: {
                data: {
                    first_name: 'Super',
                    last_name: 'Admin',
                }
            }
        });

        let userId = authData?.user?.id;

        if (authError) {
            // Si el usuario ya existe, intentamos obtener su ID
            if (authError.message.includes('already registered')) {
                console.log('ℹ️ El usuario administrador ya existe en Auth.');
                // No podemos obtener el ID fácilmente vía cliente anon si ya existe, 
                // pero podemos intentar un signIn para obtener el ID si la contraseña coincide
                const { data: signInData } = await supabase.auth.signInWithPassword({
                    email: adminEmail,
                    password: adminPassword
                });
                userId = signInData?.user?.id;
            } else {
                throw authError;
            }
        }

        if (!userId) {
            return new Response(JSON.stringify({ error: 'No se pudo obtener el ID del usuario. Verifica la contraseña en el .env' }), { status: 401 });
        }

        // 2. Asegurar que el grupo 'Administración' existe
        const { data: groupData, error: groupError } = await supabase
            .from('groups')
            .upsert({ name: 'Administración' }, { onConflict: 'name' })
            .select()
            .single();

        if (groupError) throw groupError;

        // 3. Convertir usuario en Super Admin y aprobado
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                role: 'super_admin',
                status: 'approved',
                first_name: 'Super',
                last_name: 'Admin'
            })
            .eq('id', userId);

        if (profileError) throw profileError;

        // 4. Vincular al grupo Administración
        const { error: linkError } = await supabase
            .from('user_groups')
            .upsert({ user_id: userId, group_id: groupData.id }, { onConflict: 'user_id,group_id' });

        if (linkError) throw linkError;

        console.log('✅ Setup completado con éxito.');

        return new Response(JSON.stringify({
            message: 'Setup completado con éxito',
            admin: adminEmail,
            status: 'Super Admin activado y vinculado a Administración'
        }), { status: 200 });

    } catch (error: any) {
        console.error('❌ Error en Setup:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
