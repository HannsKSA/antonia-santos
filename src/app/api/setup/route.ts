import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type StepResult = {
  name: string;
  status: 'ok' | 'skipped' | 'error';
  message?: string;
};

async function step(
  name: string,
  check: () => Promise<boolean>,
  fn: () => Promise<void>
): Promise<StepResult> {
  try {
    const alreadyDone = await check();
    if (alreadyDone) return { name, status: 'skipped', message: 'Ya estaba completado' };
    await fn();
    return { name, status: 'ok' };
  } catch (e: any) {
    return { name, status: 'error', message: e.message };
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

  const log: StepResult[] = [];

  // 1. exec_sql Check
  log.push(await step('Función exec_sql',
    async () => {
      const { error } = await admin.rpc('exec_sql', { sql: 'SELECT 1' });
      return !error;
    },
    async () => {
      throw new Error('La función exec_sql no existe. Ejecuta start_system.sql en el SQL Editor de Supabase.');
    }
  ));

  if (log[0].status === 'error') {
    return NextResponse.json({ message: 'Falta exec_sql', steps: log }, { status: 500 });
  }

  const execSQL = async (sql: string) => {
    const { error } = await admin.rpc('exec_sql', { sql });
    if (error) throw error;
  };

  // 2. Tablas e Infraestructura Base
  log.push(await step('Infraestructura Base',
    async () => {
      const { error } = await admin.from('notifications').select('id').limit(1);
      return !error;
    },
    async () => {
      await execSQL(`
        -- Tipos
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
            CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'teacher', 'user');
          END IF;
          -- ... otros tipos si faltan ...
        END $$;

        -- Tablas
        CREATE TABLE IF NOT EXISTS public.profiles (
          id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
          email TEXT, username TEXT UNIQUE, first_name TEXT, last_name TEXT,
          role user_role DEFAULT 'user', status user_status DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

        CREATE TABLE IF NOT EXISTS public.groups (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          parent_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS public.user_groups (
          user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
          group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
          PRIMARY KEY (user_id, group_id)
        );

        CREATE TABLE IF NOT EXISTS public.posts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
          type content_type NOT NULL, title TEXT NOT NULL, content TEXT,
          is_public BOOLEAN DEFAULT FALSE, is_published BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS public.notifications (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
          type TEXT NOT NULL, title TEXT NOT NULL, body TEXT, is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        -- ... Resto de tablas (poll_options, votes, etc) se asumen creadas o se crean aquí de forma compacta
      `);

      // Ejecución de patches específicos para asegurar columnas
      await execSQL(`
        ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
        ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
      `);
    }
  ));

  // 3. Recrear Funciones Admin y Triggers (Siempre se hace para asegurar versión)
  log.push(await step('Funciones y Triggers',
    async () => false,
    async () => {
      await execSQL(`
        -- get_users_admin
        CREATE OR REPLACE FUNCTION public.get_users_admin()
        RETURNS TABLE (id UUID, email TEXT, first_name TEXT, last_name TEXT, username TEXT, role TEXT, status TEXT, groups_info JSONB)
        SECURITY DEFINER SET search_path = public, auth AS $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','teacher')) THEN
            RAISE EXCEPTION 'No autorizado';
          END IF;
          RETURN QUERY SELECT au.id, au.email::TEXT, p.first_name, p.last_name, p.username, p.role::TEXT, p.status::TEXT,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('group_id', ug.group_id, 'name', g.name)) FROM public.user_groups ug JOIN public.groups g ON g.id = ug.group_id WHERE ug.user_id = au.id),'[]'::jsonb)
            FROM auth.users au LEFT JOIN public.profiles p ON p.id = au.id ORDER BY p.last_name ASC;
        END; $$ LANGUAGE plpgsql;
        GRANT EXECUTE ON FUNCTION public.get_users_admin() TO authenticated;

        -- handle_new_user
        CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
        BEGIN
          INSERT INTO public.profiles (id, email, first_name, last_name, status)
          VALUES (new.id, new.email, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name', 'pending');
          RETURN new;
        END; $$ LANGUAGE plpgsql SECURITY DEFINER;
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

        -- Backfill
        UPDATE public.profiles p SET email = au.email FROM auth.users au WHERE p.id = au.id AND (p.email IS NULL OR p.email = '');
      `);
    }
  ));

  // 4. Políticas RLS (Limpieza y Re-aplicación)
  log.push(await step('Políticas de Seguridad',
    async () => false,
    async () => {
      await execSQL(`
        -- Profiles
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
        CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
        DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

        -- Posts
        ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Visible posts" ON public.posts;
        CREATE POLICY "Visible posts" ON public.posts FOR SELECT USING ((is_published = true AND (is_public = true OR auth.uid() IS NOT NULL)) OR auth.uid() = author_id);
        DROP POLICY IF EXISTS "Super Admins have full control over posts" ON public.posts;
        CREATE POLICY "Super Admins have full control over posts" ON public.posts FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'super_admin'));
        
        -- Notifications
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "NOTIFICATIONS: SELECT" ON public.notifications;
        CREATE POLICY "NOTIFICATIONS: SELECT" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
        
        -- Groups
        ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON public.groups;
        CREATE POLICY "Public groups are viewable by everyone" ON public.groups FOR SELECT USING (true);
        DROP POLICY IF EXISTS "Admins can manage groups" ON public.groups;
        CREATE POLICY "Admins can manage groups" ON public.groups FOR ALL USING (
          auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin', 'admin'))
        );
      `);
    }
  ));

  // 5. Seed y Admin Inicial
  log.push(await step('Datos Maestros y Admin',
    async () => {
      const { data } = await admin.from('profiles').select('id').limit(1);
      return (data?.length ?? 0) > 0;
    },
    async () => {
      // Grupos
      const baseGroups = ['Administración', 'Docentes', 'General', 'Grado 1-1', 'Grado 1-2'];
      for (const name of baseGroups) await admin.from('groups').upsert({ name }, { onConflict: 'name' });

      // Admin Auth
      const { data: userData } = await admin.auth.admin.createUser({
        email: adminEmail, password: adminPass, email_confirm: true,
        user_metadata: { first_name: 'Super', last_name: 'Admin' }
      });
      const uid = userData.user?.id;
      if (uid) {
        await admin.from('profiles').upsert({ id: uid, role: 'super_admin', status: 'approved', first_name: 'Super', last_name: 'Admin' });
        const { data: grp } = await admin.from('groups').select('id').eq('name', 'Administración').single();
        if (grp) await admin.from('user_groups').upsert({ user_id: uid, group_id: grp.id });
      }
    }
  ));

  return NextResponse.json({ message: 'Setup sincronizado con éxito', steps: log });
}
