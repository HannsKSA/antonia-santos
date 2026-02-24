import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
        const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

        if (!supabaseUrl || !supabaseServiceKey || !adminEmail || !adminPassword) {
            return new Response(JSON.stringify({
                error: 'Faltan variables de entorno (URL, Service Key, o Admin Credentials)',
                details: {
                    url: !!supabaseUrl,
                    key: !!supabaseServiceKey,
                    email: !!adminEmail,
                    pass: !!adminPassword
                }
            }), { status: 400 });
        }

        // Cliente con service_role para operaciones administrativas creado DENTRO del handler
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        console.log('🚀 Iniciando Setup para:', adminEmail);

        // 1. Crear el usuario en Auth si no existe
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true,
            user_metadata: {
                first_name: 'Super',
                last_name: 'Admin',
            }
        });

        let userId = authData?.user?.id;

        if (authError) {
            // Si el usuario ya existe, intentamos obtener su ID
            if (authError.message.includes('already registered') || authError.message.includes('Email already exists')) {
                console.log('ℹ️ El usuario administrador ya existe. Buscando ID...');
                const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
                if (listError) throw listError;
                const existingUser = usersData.users.find(u => u.email === adminEmail);
                userId = existingUser?.id;
            } else {
                throw authError;
            }
        }

        if (!userId) {
            throw new Error('No se pudo encontrar ni crear el usuario administrador.');
        }

        // 2. Asegurar que el grupo 'Administración' existe
        // NOTA: Requiere que la tabla 'groups' ya exista.
        const { data: groupData, error: groupError } = await supabaseAdmin
            .from('groups')
            .upsert({ name: 'Administración' }, { onConflict: 'name' })
            .select()
            .single();

        if (groupError) {
            if (groupError.code === '42P01') {
                throw new Error('La tabla "groups" no existe. Debes ejecutar el script SQL de inicio primero.');
            }
            throw groupError;
        }

        // 3. Convertir usuario en Super Admin y aprobado
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: userId,
                role: 'super_admin',
                status: 'approved',
                first_name: 'Super',
                last_name: 'Admin'
            }, { onConflict: 'id' });

        if (profileError) throw profileError;

        // 4. Vincular al grupo Administración
        const { error: linkError } = await supabaseAdmin
            .from('user_groups')
            .upsert({ user_id: userId, group_id: groupData.id }, { onConflict: 'user_id,group_id' });

        if (linkError) throw linkError;

        return new Response(JSON.stringify({
            message: 'Setup completado con éxito',
            admin: adminEmail
        }), { status: 200 });

    } catch (error: any) {
        console.error('❌ Error en Setup:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
