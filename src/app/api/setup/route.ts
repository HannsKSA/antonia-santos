import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Paso a paso del setup. Cada función devuelve { ok, error }
async function step(name: string, fn: () => Promise<any>) {
    try {
        await fn();
        return { name, ok: true };
    } catch (e: any) {
        return { name, ok: false, error: e.message };
    }
}

export async function POST() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL!;
    const adminPass = process.env.INITIAL_ADMIN_PASSWORD!;

    if (!supabaseUrl || !serviceKey || !adminEmail || !adminPass) {
        return NextResponse.json({ error: 'Faltan variables de entorno.' }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const log: any[] = [];

    // ─── PASO 1: Crear tablas via rpc exec_sql ──────────────────────────────
    // Si "exec_sql" no existe todavía, la creamos antes
    const tablesSQL = `
        DO $$ BEGIN
          CREATE TYPE IF NOT EXISTS user_role AS ENUM('super_admin','admin','teacher','user');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN
          CREATE TYPE IF NOT EXISTS user_sub_role AS ENUM('representative','student','teacher');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN
          CREATE TYPE IF NOT EXISTS user_status AS ENUM('pending','approved','rejected');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN
          CREATE TYPE IF NOT EXISTS content_type AS ENUM('news','event','survey','proposal');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN
          CREATE TYPE IF NOT EXISTS multimedia_type AS ENUM('internal','external');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;

        CREATE TABLE IF NOT EXISTS profiles (
          id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
          username TEXT UNIQUE, first_name TEXT, last_name TEXT, phone TEXT,
          role user_role DEFAULT 'user', sub_role user_sub_role,
          status user_status DEFAULT 'pending', represented_name TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS groups (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS user_groups (
          user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
          PRIMARY KEY (user_id, group_id)
        );
        CREATE TABLE IF NOT EXISTS posts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          type content_type NOT NULL, title TEXT NOT NULL, content TEXT,
          multimedia_url TEXT, multimedia_kind multimedia_type DEFAULT 'internal',
          group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
          is_published BOOLEAN DEFAULT FALSE, expires_at TIMESTAMPTZ,
          is_closed BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS post_reads (
          post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
          user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (post_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS comments (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
          user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS proposal_votes (
          post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
          user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          vote_type TEXT CHECK (vote_type IN ('up','down')),
          PRIMARY KEY (post_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS reports (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
          post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
          comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
          reason TEXT NOT NULL, status TEXT DEFAULT 'pending'
            CHECK (status IN ('pending','reviewed','dismissed')),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
          type TEXT NOT NULL CHECK (type IN (
            'new_post','new_proposal','new_comment','approved','rejected','vote_milestone'
          )),
          title TEXT NOT NULL, body TEXT, link TEXT,
          is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `;

    // Intentar ejecutar via RPC "exec_sql" (función auxiliar de migración)
    // Si falla, informamos al usuario que lo ejecute manualmente (solo primera vez)
    const rpcResult = await admin.rpc('exec_sql', { sql: tablesSQL });
    log.push(await step('Tablas DB', async () => {
        if (rpcResult.error) {
            // La función exec_sql no existe aún — solo la primera vez falla aquí
            // Intentamos crear las tablas que podemos via la API normal
            throw new Error('La función exec_sql no existe. Ejecuta el SQL de inicio una sola vez en Supabase, luego este botón manejará todo automáticamente.');
        }
    }));

    // ─── PASO 2: Grupos base ─────────────────────────────────────────────────
    log.push(await step('Grupos base', async () => {
        const groups = ['Administración', 'Docentes', 'General', 'Grado 1-1', 'Grado 1-2'];
        for (const name of groups) {
            await admin.from('groups').upsert({ name }, { onConflict: 'name' });
        }
    }));

    // ─── PASO 3: Super Admin user ────────────────────────────────────────────
    let userId: string | undefined;
    log.push(await step('Super Admin Auth', async () => {
        const { data, error } = await admin.auth.admin.createUser({
            email: adminEmail, password: adminPass,
            email_confirm: true,
            user_metadata: { first_name: 'Super', last_name: 'Admin' }
        });

        if (error) {
            if (error.message.includes('already registered') || error.message.includes('already exists')) {
                const { data: list } = await admin.auth.admin.listUsers();
                const existing = list?.users.find(u => u.email === adminEmail);
                userId = existing?.id;
            } else throw error;
        } else {
            userId = data.user?.id;
        }
    }));

    // ─── PASO 4: Perfil super admin ──────────────────────────────────────────
    log.push(await step('Perfil super_admin', async () => {
        if (!userId) throw new Error('No se pudo obtener el userId del admin');
        const { error } = await admin.from('profiles').upsert({
            id: userId, role: 'super_admin', status: 'approved',
            first_name: 'Super', last_name: 'Admin'
        }, { onConflict: 'id' });
        if (error) throw error;
    }));

    // ─── PASO 5: Vincular al grupo Administración ────────────────────────────
    log.push(await step('Vincular a Administración', async () => {
        if (!userId) return;
        const { data: grp } = await admin.from('groups').select('id').eq('name', 'Administración').single();
        if (grp) {
            await admin.from('user_groups').upsert(
                { user_id: userId, group_id: grp.id }, { onConflict: 'user_id,group_id' }
            );
        }
    }));

    const failed = log.filter(s => !s.ok);
    const status = failed.length === 0 ? 200 : (log.some(s => s.ok) ? 207 : 500);

    return NextResponse.json({
        message: failed.length === 0
            ? '✅ Setup completado con éxito'
            : `⚠️ Setup parcial: ${failed.length} paso(s) con advertencias`,
        steps: log,
        admin: adminEmail,
    }, { status });
}
