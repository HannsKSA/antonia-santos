-- ==========================================
-- 🚀 SCRIPT DEFINITIVO DE INFRAESTRUCTURA — IE ANTONIA SANTOS
-- ==========================================
-- Este script unifica toda la base de datos de forma limpia y profesional.
-- Es seguro ejecutarlo varias veces (idempotente).

-- ==========================================
-- 0. FUNCIONES AUXILIARES Y EXTENSIONES
-- ==========================================

-- Permite ejecución de SQL dinámico desde la API (solo service_role)
CREATE OR REPLACE FUNCTION public.exec_sql(sql TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.exec_sql(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;

-- Extensión para IDs aleatorios
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. TIPOS ENUM
-- ==========================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'teacher', 'user');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_sub_role') THEN
        CREATE TYPE user_sub_role AS ENUM ('representative', 'student', 'teacher');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type') THEN
        CREATE TYPE content_type AS ENUM ('news', 'event', 'survey', 'proposal');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'multimedia_type') THEN
        CREATE TYPE multimedia_type AS ENUM ('internal', 'external');
    END IF;
END $$;

-- ==========================================
-- 2. TABLAS NÚCLEO
-- ==========================================

-- PERFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  username TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  role user_role DEFAULT 'user',
  sub_role user_sub_role,
  status user_status DEFAULT 'pending',
  represented_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columna email si la tabla ya existía
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- GRUPOS (Grados/Secciones)
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MEMBRESÍAS (Relación N:M)
CREATE TABLE IF NOT EXISTS public.user_groups (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

-- ==========================================
-- 3. TABLAS DE CONTENIDO
-- ==========================================

-- POSTS (Noticias, Propuestas, Encuestas)
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type content_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  multimedia_url TEXT,
  multimedia_kind multimedia_type DEFAULT 'internal',
  media JSONB DEFAULT '[]'::jsonb,
  is_public BOOLEAN DEFAULT FALSE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  is_published BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parche para columnas nuevas en posts si ya existía
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='media') THEN
    ALTER TABLE public.posts ADD COLUMN media JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='is_public') THEN
    ALTER TABLE public.posts ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- INTERACCIONES DE POSTS
CREATE TABLE IF NOT EXISTS public.post_reads (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

-- ENCUESTAS
CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.votes (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- COMENTARIOS Y MODERACIÓN
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROPUESTAS (Votos sociales)
CREATE TABLE IF NOT EXISTS public.proposal_votes (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote_type TEXT CHECK (vote_type IN ('up', 'down')),
  PRIMARY KEY (post_id, user_id)
);

-- ==========================================
-- 4. SISTEMA DE NOTIFICACIONES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 5. FUNCIONES DE ADMINISTRACIÓN
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_users_admin()
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

-- Función para obtener grupos visibles por jerarquía
CREATE OR REPLACE FUNCTION public.get_user_visible_groups(u_id UUID)
RETURNS TABLE (group_id UUID) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE group_hierarchy AS (
    -- Grupos directos del usuario
    SELECT ug.group_id FROM public.user_groups ug WHERE ug.user_id = u_id
    UNION
    -- Sus ancestros (padres, abuelos...)
    SELECT g.parent_id
    FROM public.groups g
    JOIN group_hierarchy gh ON g.id = gh.group_id
    WHERE g.parent_id IS NOT NULL
  )
  SELECT DISTINCT gh.group_id FROM group_hierarchy gh;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_users_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_visible_groups(UUID) TO authenticated;

-- ==========================================
-- 6. POLÍTICAS RLS (Seguridad)
-- ==========================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can update profile status" ON public.profiles;
CREATE POLICY "Admins can update profile status" ON public.profiles FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin', 'admin', 'teacher'))
);

-- GROUPS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON public.groups;
CREATE POLICY "Public groups are viewable by everyone" ON public.groups FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage groups" ON public.groups;
CREATE POLICY "Admins can manage groups" ON public.groups FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin', 'admin'))
);

-- USER_GROUPS
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see memberships" ON public.user_groups;
CREATE POLICY "Users can see memberships" ON public.user_groups FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can join groups" ON public.user_groups;
CREATE POLICY "Users can join groups" ON public.user_groups FOR INSERT WITH CHECK (auth.uid() = user_id);

-- POSTS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visible posts" ON public.posts;
CREATE POLICY "Visible posts" ON public.posts FOR SELECT USING (
  (is_published = true AND (is_public = true OR auth.uid() IS NOT NULL))
  OR auth.uid() = author_id
);
DROP POLICY IF EXISTS "Authors can create posts" ON public.posts;
CREATE POLICY "Authors can create posts" ON public.posts FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin', 'admin', 'teacher'))
);
DROP POLICY IF EXISTS "Authors and Admins can update posts" ON public.posts;
CREATE POLICY "Authors and Admins can update posts" ON public.posts FOR UPDATE USING (
  auth.uid() = author_id OR 
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin', 'admin', 'teacher'))
);

-- POSTS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Visible posts" ON public.posts;
CREATE POLICY "Visible posts" ON public.posts FOR SELECT USING (
  (is_published = true AND (
    is_public = true 
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin', 'admin', 'teacher'))
    OR posts.group_id IN (SELECT group_id FROM public.get_user_visible_groups(auth.uid()))
  ))
  OR auth.uid() = author_id
);

-- POST INTERACTIONS (Likes / Reads)
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Likes: SELECT" ON public.post_likes;
CREATE POLICY "Likes: SELECT" ON public.post_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Likes: INSERT/DELETE" ON public.post_likes;
CREATE POLICY "Likes: INSERT/DELETE" ON public.post_likes FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.post_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reads: SELECT" ON public.post_reads;
CREATE POLICY "Reads: SELECT" ON public.post_reads FOR SELECT USING (
  auth.uid() = user_id OR 
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin', 'admin', 'teacher'))
);
DROP POLICY IF EXISTS "Reads: INSERT" ON public.post_reads;
CREATE POLICY "Reads: INSERT" ON public.post_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- COMMENTS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "COMMENTS: SELECT" ON public.comments;
CREATE POLICY "COMMENTS: SELECT" ON public.comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "COMMENTS: INSERT" ON public.comments;
CREATE POLICY "COMMENTS: INSERT" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "COMMENTS: DELETE" ON public.comments;
CREATE POLICY "COMMENTS: DELETE" ON public.comments FOR DELETE USING (
  auth.uid() = user_id OR 
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin', 'admin'))
);

-- POLLS
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "POLL_OPTIONS: SELECT" ON public.poll_options;
CREATE POLICY "POLL_OPTIONS: SELECT" ON public.poll_options FOR SELECT USING (true);
DROP POLICY IF EXISTS "POLL_OPTIONS: INSERT" ON public.poll_options;
CREATE POLICY "POLL_OPTIONS: INSERT" ON public.poll_options FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT author_id FROM public.posts WHERE id = post_id)
);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "VOTES: SELECT" ON public.votes;
CREATE POLICY "VOTES: SELECT" ON public.votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "VOTES: INSERT" ON public.votes;
CREATE POLICY "VOTES: INSERT" ON public.votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- PROPOSALS
ALTER TABLE public.proposal_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PROPOSAL_VOTES: SELECT" ON public.proposal_votes;
CREATE POLICY "PROPOSAL_VOTES: SELECT" ON public.proposal_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "PROPOSAL_VOTES: INSERT/UPDATE" ON public.proposal_votes;
CREATE POLICY "PROPOSAL_VOTES: INSERT/UPDATE" ON public.proposal_votes FOR ALL USING (auth.uid() = user_id);

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "NOTIFICATIONS: SELECT" ON public.notifications;
CREATE POLICY "NOTIFICATIONS: SELECT" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "NOTIFICATIONS: SYSTEM_INSERT" ON public.notifications;
CREATE POLICY "NOTIFICATIONS: SYSTEM_INSERT" ON public.notifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "NOTIFICATIONS: UPDATE" ON public.notifications;
CREATE POLICY "NOTIFICATIONS: UPDATE" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- ==========================================
-- 7. TRIGGERS (Automatización)
-- ==========================================

-- Trigger: Crear perfil al registrarse + Backfill
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

-- Trigger: Actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Trigger: Notificar nuevo post
CREATE OR REPLACE FUNCTION public.notify_on_new_post()
RETURNS TRIGGER AS $$
DECLARE
  member_id UUID;
  post_title TEXT := CASE 
    WHEN NEW.type = 'news' THEN '📰 Nueva noticia'
    WHEN NEW.type = 'proposal' THEN '💡 Nueva propuesta'
    ELSE '📊 Nueva encuesta'
  END;
BEGIN
  IF NEW.is_published = TRUE THEN
    FOR member_id IN 
      SELECT ug.user_id FROM public.user_groups ug WHERE ug.group_id = NEW.group_id 
    LOOP
      IF member_id != NEW.author_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, title, body, link)
        VALUES (member_id, NEW.author_id, 'new_post', post_title || ': ' || NEW.title, LEFT(NEW.content, 120), '/dashboard');
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_published ON public.posts;
CREATE TRIGGER on_post_published AFTER INSERT OR UPDATE OF is_published ON public.posts FOR EACH ROW WHEN (NEW.is_published = TRUE) EXECUTE PROCEDURE public.notify_on_new_post();

-- ==========================================
-- 8. DATOS INICIALES (Seed)
-- ==========================================

INSERT INTO public.groups (name) VALUES 
('Administración'), ('Docentes'), ('General'), 
('Grado 1-1'), ('Grado 1-2'), ('Grado 2-1'), ('Grado 3-1')
ON CONFLICT (name) DO NOTHING;

-- Backfill final de emails (por seguridad)
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND (p.email IS NULL OR p.email = '');
