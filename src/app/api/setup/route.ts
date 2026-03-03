import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type StepResult = {
  name: string;
  status: 'ok' | 'skipped' | 'error';
  message?: string;
};

/** Ejecuta fn(). Si lanza, captura el error. Si check() devuelve true, omite fn() como 'skipped'. */
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

  // ─── PASO 1: Verificar que exec_sql existe ────────────────────────────────
  log.push(await step(
    'Función exec_sql',
    async () => {
      const { error } = await admin.rpc('exec_sql', { sql: 'SELECT 1' });
      return !error;
    },
    async () => {
      throw new Error(
        'La función exec_sql no existe. Ejecuta start_system.sql una sola vez en el SQL Editor de Supabase para habilitarla.'
      );
    }
  ));

  // Si exec_sql no está disponible, no tiene sentido continuar
  if (log[0].status === 'error') {
    return NextResponse.json({
      message: '❌ No se puede continuar sin exec_sql',
      steps: log,
    }, { status: 500 });
  }

  const execSQL = async (sql: string) => {
    const { error } = await admin.rpc('exec_sql', { sql });
    if (error) throw error;
  };

  // ─── PASO 2: Tablas DB ────────────────────────────────────────────────────
  log.push(await step(
    'Tablas DB',
    async () => {
      // Verificar que la tabla más reciente (notifications) ya existe
      const { error } = await admin.from('notifications').select('id').limit(1);
      return !error;
    },
    async () => {
      await execSQL(`
                DO $$ BEGIN
                  CREATE TYPE user_role AS ENUM('super_admin','admin','teacher','user');
                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
                DO $$ BEGIN
                  CREATE TYPE user_sub_role AS ENUM('representative','student','teacher');
                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
                DO $$ BEGIN
                  CREATE TYPE user_status AS ENUM('pending','approved','rejected');
                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
                DO $$ BEGIN
                  CREATE TYPE content_type AS ENUM('news','event','survey','proposal');
                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
                DO $$ BEGIN
                  CREATE TYPE multimedia_type AS ENUM('internal','external');
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
                  media JSONB DEFAULT '[]'::jsonb,
                  is_public BOOLEAN DEFAULT FALSE,
                  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
                  is_published BOOLEAN DEFAULT FALSE, expires_at TIMESTAMPTZ,
                  is_closed BOOLEAN DEFAULT FALSE,
                  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
                );
                -- Asegurar que las columnas nuevas existan si la tabla ya había sido creada antes
                DO $$ 
                BEGIN 
                  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='media') THEN
                    ALTER TABLE posts ADD COLUMN media JSONB DEFAULT '[]'::jsonb;
                  END IF;
                  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='is_public') THEN
                    ALTER TABLE posts ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
                  END IF;
                END $$;

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
                CREATE TABLE IF NOT EXISTS post_likes (
                  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
                  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
                  PRIMARY KEY (post_id, user_id)
                );
                CREATE TABLE IF NOT EXISTS proposal_votes (
                  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
                  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
                  vote_type TEXT CHECK (vote_type IN ('up','down')),
                  PRIMARY KEY (post_id, user_id)
                );
                CREATE TABLE IF NOT EXISTS poll_options (
                  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
                  option_text TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS votes (
                  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
                  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
                  option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE,
                  created_at TIMESTAMPTZ DEFAULT NOW(),
                  PRIMARY KEY (user_id, post_id)
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
            `);
    }
  ));

  // ─── PASO 3: Función get_users_admin (siempre se recrea) ──────────────────
  log.push(await step(
    'Función get_users_admin',
    async () => false, // siempre recrear (CREATE OR REPLACE es idempotente)
    async () => {
      await execSQL(`
        CREATE OR REPLACE FUNCTION get_users_admin()
        RETURNS TABLE (
          id UUID,
          email TEXT,
          first_name TEXT,
          last_name TEXT,
          username TEXT,
          role TEXT,
          status TEXT,
          groups_info JSONB
        )
        SECURITY DEFINER
        SET search_path = public, auth
        AS $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'admin', 'teacher')
          ) THEN
            RAISE EXCEPTION 'No autorizado';
          END IF;

          RETURN QUERY
          SELECT
            au.id,
            au.email::TEXT,
            p.first_name,
            p.last_name,
            p.username,
            p.role::TEXT,
            p.status::TEXT,
            COALESCE(
              (SELECT jsonb_agg(jsonb_build_object('group_id', ug.group_id, 'name', g.name))
               FROM public.user_groups ug
               JOIN public.groups g ON g.id = ug.group_id
               WHERE ug.user_id = au.id),
              '[]'::jsonb
            ) AS groups_info
          FROM auth.users au
          LEFT JOIN public.profiles p ON p.id = au.id
          ORDER BY p.last_name ASC;
        END;
        $$ LANGUAGE plpgsql;

        -- Asegurar que solo service_role y usuarios autenticados puedan ejecutarla
        GRANT EXECUTE ON FUNCTION get_users_admin() TO authenticated;
      `);
    }
  ));

  // ─── PASO 4: Políticas RLS (idempotente — siempre se aplican) ────────────
  // Solo permite a usuarios UNIRSE a grupos existentes, no crearlos.
  log.push(await step(
    'Políticas RLS',
    async () => {
      // Verificar si la política de INSERT ya existe
      const { data } = await admin.rpc('exec_sql', {
        sql: `SELECT 1 FROM pg_policies WHERE tablename = 'user_groups' AND cmd = 'INSERT' LIMIT 1`
      });
      // exec_sql devuelve void; si no lanza error consideramos que hay que verificar igual
      // Mejor verificar directamente la tabla del catálogo
      return false; // Siempre re-aplicar (son idempotentes con DROP IF EXISTS)
    },
    async () => {
      await execSQL(`
                -- GROUPS: solo lectura para todos
                ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON groups;
                CREATE POLICY "Public groups are viewable by everyone"
                  ON groups FOR SELECT USING (true);

                -- USER_GROUPS: un usuario solo accede/modifica sus propias membresías + admins ven todo
                ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Users can see their own group memberships" ON user_groups;
                CREATE POLICY "Users can see their own group memberships"
                  ON user_groups FOR SELECT USING (auth.uid() = user_id);
                DROP POLICY IF EXISTS "Admins can see all group memberships" ON user_groups;
                CREATE POLICY "Admins can see all group memberships"
                  ON user_groups FOR SELECT USING (
                    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin', 'admin', 'teacher'))
                  );
                DROP POLICY IF EXISTS "Users can insert their own group memberships" ON user_groups;
                CREATE POLICY "Users can insert their own group memberships"
                  ON user_groups FOR INSERT WITH CHECK (auth.uid() = user_id);

                -- PROFILES
                ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
                CREATE POLICY "Public profiles are viewable by everyone"
                  ON profiles FOR SELECT USING (true);
                DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
                CREATE POLICY "Users can update own profile"
                  ON profiles FOR UPDATE USING (auth.uid() = id);

                DROP POLICY IF EXISTS "Admins can update profile status" ON profiles;
                CREATE POLICY "Admins can update profile status"
                  ON profiles FOR UPDATE USING (
                    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin', 'admin', 'teacher'))
                  );

                DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON posts;
                CREATE POLICY "Public posts are viewable by everyone"
                  ON posts FOR SELECT USING (is_published = true AND (is_public = true OR auth.uid() IS NOT NULL));
                DROP POLICY IF EXISTS "Super Admins have full control over posts" ON posts;
                CREATE POLICY "Super Admins have full control over posts"
                  ON posts FOR ALL USING (
                    auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
                  );
                DROP POLICY IF EXISTS "Admins and Teachers can edit or hide posts" ON posts;
                CREATE POLICY "Admins and Teachers can edit or hide posts"
                  ON posts FOR UPDATE USING (
                    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','teacher'))
                  );
                DROP POLICY IF EXISTS "Authors can create posts" ON posts;
                CREATE POLICY "Authors can create posts"
                  ON posts FOR INSERT WITH CHECK (
                    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin','admin','teacher'))
                  );

                -- NOTIFICACIONES
                ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Users see their own notifications" ON notifications;
                CREATE POLICY "Users see their own notifications"
                  ON notifications FOR SELECT USING (auth.uid() = user_id);
                DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
                CREATE POLICY "System can insert notifications"
                  ON notifications FOR INSERT WITH CHECK (true);
                DROP POLICY IF EXISTS "Users can mark notifications as read" ON notifications;
                CREATE POLICY "Users can mark notifications as read"
                  ON notifications FOR UPDATE USING (auth.uid() = user_id);

                -- POST_READS
                ALTER TABLE post_reads ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Users can insert their own reads" ON post_reads;
                CREATE POLICY "Users can insert their own reads"
                  ON post_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

                -- COMMENTS
                ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
                CREATE POLICY "Comments are viewable by everyone"
                  ON comments FOR SELECT USING (true);
                DROP POLICY IF EXISTS "Users can insert comments" ON comments;
                CREATE POLICY "Users can insert comments"
                  ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
                DROP POLICY IF EXISTS "Users can edit their own comments" ON comments;
                CREATE POLICY "Users can edit their own comments"
                  ON comments FOR UPDATE USING (auth.uid() = user_id);
                DROP POLICY IF EXISTS "Super Admins can delete or hide comments" ON comments;
                CREATE POLICY "Super Admins can delete or hide comments"
                  ON comments FOR ALL USING (
                    auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
                  );

                -- POST_LIKES
                ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Likes are viewable by everyone" ON post_likes;
                CREATE POLICY "Likes are viewable by everyone"
                  ON post_likes FOR SELECT USING (true);
                DROP POLICY IF EXISTS "Users can like posts" ON post_likes;
                CREATE POLICY "Users can like posts"
                  ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
                DROP POLICY IF EXISTS "Users can unlike posts" ON post_likes;
                CREATE POLICY "Users can unlike posts"
                  ON post_likes FOR DELETE USING (auth.uid() = user_id);

                -- VOTES
                ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Votes are viewable by everyone" ON proposal_votes;
                CREATE POLICY "Votes are viewable by everyone"
                  ON proposal_votes FOR SELECT USING (true);
                DROP POLICY IF EXISTS "Users can vote once per post" ON proposal_votes;
                CREATE POLICY "Users can vote once per post"
                  ON proposal_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
                DROP POLICY IF EXISTS "Users can update their vote" ON proposal_votes;
                CREATE POLICY "Users can update their vote"
                  ON proposal_votes FOR UPDATE USING (auth.uid() = user_id);

                -- POLL_OPTIONS
                ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Poll options are viewable by everyone" ON poll_options;
                CREATE POLICY "Poll options are viewable by everyone"
                  ON poll_options FOR SELECT USING (true);
                DROP POLICY IF EXISTS "Authors can create poll options" ON poll_options;
                CREATE POLICY "Authors can create poll options"
                  ON poll_options FOR INSERT WITH CHECK (
                    auth.uid() IN (SELECT author_id FROM posts WHERE id = post_id)
                  );
                DROP POLICY IF EXISTS "Super Admins have full control over poll options" ON poll_options;
                CREATE POLICY "Super Admins have full control over poll options"
                  ON poll_options FOR ALL USING (
                    auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
                  );

                -- VOTES (Polls)
                ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Votes are viewable by everyone" ON votes;
                CREATE POLICY "Votes are viewable by everyone"
                  ON votes FOR SELECT USING (true);
                DROP POLICY IF EXISTS "Users can vote in polls" ON votes;
                CREATE POLICY "Users can vote in polls"
                  ON votes FOR INSERT WITH CHECK (auth.uid() = user_id);
                DROP POLICY IF EXISTS "Users can change their poll vote" ON votes;
                CREATE POLICY "Users can change their poll vote"
                  ON votes FOR UPDATE USING (auth.uid() = user_id);

                -- REPORTS
                ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS "Users can create reports" ON reports;
                CREATE POLICY "Users can create reports"
                  ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
                DROP POLICY IF EXISTS "Only admins can view reports" ON reports;
                CREATE POLICY "Only admins can view reports"
                  ON reports FOR SELECT USING (
                    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin','admin','teacher'))
                  );
                DROP POLICY IF EXISTS "Admins can update report status" ON reports;
                CREATE POLICY "Admins can update report status"
                  ON reports FOR UPDATE USING (
                    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin','admin'))
                  );
            `);
    }
  ));

  // ─── PASO 4: Grupos base ──────────────────────────────────────────────────
  const baseGroups = ['Administración', 'Docentes', 'General', 'Grado 1-1', 'Grado 1-2'];
  log.push(await step(
    'Grupos base',
    async () => {
      const { data } = await admin.from('groups').select('name').in('name', baseGroups);
      return (data?.length ?? 0) >= baseGroups.length;
    },
    async () => {
      for (const name of baseGroups) {
        await admin.from('groups').upsert({ name }, { onConflict: 'name' });
      }
    }
  ));

  // ─── PASO 5: Super Admin (Auth) ───────────────────────────────────────────
  let userId: string | undefined;
  log.push(await step(
    'Super Admin (Auth)',
    async () => {
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users.find(u => u.email === adminEmail);
      if (existing) { userId = existing.id; return true; }
      return false;
    },
    async () => {
      const { data, error } = await admin.auth.admin.createUser({
        email: adminEmail, password: adminPass,
        email_confirm: true,
        user_metadata: { first_name: 'Super', last_name: 'Admin' }
      });
      if (error) throw error;
      userId = data.user?.id;
    }
  ));

  // ─── PASO 6: Perfil super_admin ───────────────────────────────────────────
  log.push(await step(
    'Perfil super_admin',
    async () => {
      if (!userId) return false;
      const { data } = await admin.from('profiles').select('role').eq('id', userId).single();
      return data?.role === 'super_admin';
    },
    async () => {
      if (!userId) throw new Error('No se pudo obtener el userId del admin');
      const { error } = await admin.from('profiles').upsert({
        id: userId,
        role: 'super_admin', status: 'approved',
        first_name: 'Super', last_name: 'Admin'
      }, { onConflict: 'id' });
      if (error) throw error;
    }
  ));

  // ─── PASO 7: Vincular admin al grupo Administración ───────────────────────
  log.push(await step(
    'Vincular a Administración',
    async () => {
      if (!userId) return false;
      const { data: grp } = await admin.from('groups').select('id').eq('name', 'Administración').single();
      if (!grp) return false;
      const { data } = await admin.from('user_groups')
        .select('user_id').eq('user_id', userId).eq('group_id', grp.id).single();
      return !!data;
    },
    async () => {
      if (!userId) return;
      const { data: grp } = await admin.from('groups').select('id').eq('name', 'Administración').single();
      if (grp) {
        const { error } = await admin.from('user_groups').upsert(
          { user_id: userId, group_id: grp.id }, { onConflict: 'user_id,group_id' }
        );
        if (error) throw error;
      }
    }
  ));

  // ─── PASO 8: Trigger handle_new_user + backfill de emails ────────────────
  log.push(await step(
    'Trigger + Backfill emails',
    async () => false, // siempre re-aplicar
    async () => {
      await execSQL(`
        -- Asegurar que la columna email exista en profiles
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

        -- Actualizar trigger para guardar email en profiles al registrarse
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER AS $$
        BEGIN
          INSERT INTO public.profiles (id, email, first_name, last_name, status)
          VALUES (
            new.id,
            new.email,
            new.raw_user_meta_data->>'first_name',
            new.raw_user_meta_data->>'last_name',
            'pending'
          );
          RETURN new;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

        -- Backfill: copiar email de auth.users a profiles donde esté vacío
        UPDATE public.profiles p
        SET email = au.email
        FROM auth.users au
        WHERE p.id = au.id
          AND (p.email IS NULL OR p.email = '');
      `);
    }
  ));

  // ─── PASO 9: Refrescar Cache de Esquema ─────────────────────────────────────
  log.push(await step(
    'Refrescar Cache SQL',
    async () => false,
    async () => {
      await execSQL(`NOTIFY pgrst, 'reload schema';`);
    }
  ));

  const failed = log.filter(s => s.status === 'error');
  const skipped = log.filter(s => s.status === 'skipped');
  const completed = log.filter(s => s.status === 'ok');

  const httpStatus = failed.length === log.length ? 500 : (failed.length > 0 ? 207 : 200);

  return NextResponse.json({
    message: failed.length === 0
      ? `✅ Setup OK — ${completed.length} completados, ${skipped.length} ya estaban listos`
      : `⚠️ ${failed.length} paso(s) fallaron — ${completed.length} OK, ${skipped.length} omitidos`,
    steps: log,
    admin: adminEmail,
  }, { status: httpStatus });
}
