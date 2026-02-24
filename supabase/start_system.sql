-- ==========================================
-- 🚀 SCRIPT DE INICIO — IE ANTONIA Santos
-- Ejecuta esto UNA sola vez en el SQL Editor de Supabase.
-- Después de esto, el botón de Setup en /setup manejará
-- actualizaciones automáticamente sin necesidad de volver aquí.
-- ==========================================

-- 0. FUNCIÓN AUXILIAR: exec_sql
-- Permite que la API /api/setup ejecute SQL directamente en el futuro.
CREATE OR REPLACE FUNCTION public.exec_sql(sql TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Restringir acceso solo al service_role
REVOKE ALL ON FUNCTION public.exec_sql(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;

-- 1. CREACIÓN DE TIPOS ENUM
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

-- 2. TABLA DE PERFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
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

-- 3. TABLA DE GRUPOS (GRADOS)
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE SUBSCRIPCIONES (N:M)
CREATE TABLE IF NOT EXISTS user_groups (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

-- 5. TABLA DE POSTS (NOTICIAS/EVENTOS)
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type content_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  multimedia_url TEXT,
  multimedia_kind multimedia_type DEFAULT 'internal',
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  is_published BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA DE REGISTROS DE LECTURA (ENTERADOS)
CREATE TABLE IF NOT EXISTS post_reads (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- 7. INSERTAR DATOS INICIALES (GRUPOS)
INSERT INTO groups (name) VALUES 
('Administración'), 
('Docentes'), 
('General'), 
('Grado 1-1'), 
('Grado 1-2')
ON CONFLICT (name) DO NOTHING;

-- 8. POLÍTICAS DE SEGURIDAD (RLS)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON groups;
CREATE POLICY "Public groups are viewable by everyone" ON groups FOR SELECT USING (true);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see their own group memberships" ON user_groups;
CREATE POLICY "Users can see their own group memberships" ON user_groups FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON posts;
CREATE POLICY "Public posts are viewable by everyone" ON posts FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS "Authors and admins can manage posts" ON posts;
CREATE POLICY "Authors and admins can manage posts" ON posts FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin', 'admin', 'teacher'))
);

ALTER TABLE post_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own reads" ON post_reads;
CREATE POLICY "Users can insert their own reads" ON post_reads FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Authors can view reads of their posts" ON post_reads;
CREATE POLICY "Authors can view reads of their posts" ON post_reads FOR SELECT USING (
  EXISTS (SELECT 1 FROM posts WHERE posts.id = post_id AND posts.author_id = auth.uid()) OR 
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
);

-- 10. TABLA DE COMENTARIOS (Para el refinamiento de propuestas)
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TABLA DE VOTOS (Apoyo social a propuestas)
CREATE TABLE IF NOT EXISTS proposal_votes (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  vote_type TEXT CHECK (vote_type IN ('up', 'down')),
  PRIMARY KEY (post_id, user_id)
);

-- 12. TABLA DE REPORTES (Denuncias)
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. POLÍTICAS RLS ACTUALIZADAS (Idempotentes - se pueden ejecutar múltiples veces)

-- POSTS: Moderación por roles
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authors and admins can manage posts" ON posts;
DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Super Admins have full control over posts" ON posts;
DROP POLICY IF EXISTS "Admins and Teachers can edit or hide posts" ON posts;

CREATE POLICY "Public posts are viewable by everyone" ON posts 
FOR SELECT USING (is_published = true);

CREATE POLICY "Super Admins have full control over posts" ON posts 
FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
);

CREATE POLICY "Admins and Teachers can edit or hide posts" ON posts 
FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'teacher'))
);

CREATE POLICY "Authors can create posts" ON posts 
FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin', 'admin', 'teacher'))
);

-- COMENTARIOS: Moderación por roles
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
DROP POLICY IF EXISTS "Users can comment on posts" ON comments;
DROP POLICY IF EXISTS "Users can edit their own comments" ON comments;
DROP POLICY IF EXISTS "Super Admins can delete or hide comments" ON comments;
DROP POLICY IF EXISTS "Admins can hide comments" ON comments;

CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit their own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Super Admins can delete or hide comments" ON comments FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
);

CREATE POLICY "Admins can hide comments" ON comments FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'teacher'))
);

-- VOTOS
ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Votes are viewable by everyone" ON proposal_votes;
DROP POLICY IF EXISTS "Users can vote once per post" ON proposal_votes;
DROP POLICY IF EXISTS "Users can update their vote" ON proposal_votes;

CREATE POLICY "Votes are viewable by everyone" ON proposal_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote once per post" ON proposal_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their vote" ON proposal_votes FOR UPDATE USING (auth.uid() = user_id);

-- REPORTES: Solo admins ven, cualquier usuario puede crear
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Only admins can view reports" ON reports;

CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Only admins can view reports" ON reports FOR SELECT USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin', 'admin', 'teacher'))
);
CREATE POLICY "Admins can update report status" ON reports FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('super_admin', 'admin'))
);

-- 14. TRIGGER PARA CREAR PERFIL AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, status)
  VALUES (new.id, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name', 'pending');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- 15. SISTEMA DE NOTIFICACIONES IN-APP
-- ==========================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- destinatario
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- quien generó la acción
  type TEXT NOT NULL CHECK (type IN (
    'new_post',       -- nueva noticia en mi grupo
    'new_proposal',   -- nueva propuesta en mi grupo
    'new_comment',    -- comentario en una propuesta mía
    'approved',       -- mi cuenta fue aprobada
    'rejected',       -- mi cuenta fue rechazada
    'vote_milestone'  -- la propuesta alcanzó 5 votos
  )),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,         -- ruta a donde navegar
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can mark notifications as read" ON notifications;

CREATE POLICY "Users see their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can mark notifications as read" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ==========================================
-- 16. FUNCIÓN: Notificar a miembros del grupo cuando se publica un post
-- ==========================================
CREATE OR REPLACE FUNCTION public.notify_group_on_new_post()
RETURNS TRIGGER AS $$
DECLARE
  member RECORD;
  post_type TEXT;
  notif_title TEXT;
BEGIN
  -- Solo notificar si el post se publica directamente
  IF NEW.is_published = TRUE THEN
    IF NEW.type = 'news' THEN
      notif_title := '📰 Nueva noticia: ' || NEW.title;
      post_type := 'new_post';
    ELSE
      notif_title := '💡 Nueva propuesta: ' || NEW.title;
      post_type := 'new_proposal';
    END IF;

    -- Insertar notificación para cada miembro del grupo destino
    FOR member IN
      SELECT ug.user_id FROM user_groups ug WHERE ug.group_id = NEW.group_id
    LOOP
      -- No notificar al propio autor
      IF member.user_id != NEW.author_id THEN
        INSERT INTO notifications (user_id, actor_id, type, title, body, link)
        VALUES (
          member.user_id,
          NEW.author_id,
          post_type,
          notif_title,
          LEFT(NEW.content, 120),
          '/dashboard'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_published ON posts;
CREATE TRIGGER on_post_published
  AFTER INSERT ON posts
  FOR EACH ROW EXECUTE PROCEDURE public.notify_group_on_new_post();

-- ==========================================
-- 17. FUNCIÓN: Notificar al usuario cuando su cuenta es aprobada/rechazada
-- ==========================================
CREATE OR REPLACE FUNCTION public.notify_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        NEW.id,
        'approved',
        '✅ ¡Tu cuenta fue aprobada!',
        'Ya puedes ver las noticias y propuestas de tus grupos.',
        '/dashboard'
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        NEW.id,
        'rejected',
        '❌ Tu solicitud no fue aprobada',
        'Contacta a tu docente para más información.',
        '/'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_status_changed ON profiles;
CREATE TRIGGER on_profile_status_changed
  AFTER UPDATE OF status ON profiles
  FOR EACH ROW EXECUTE PROCEDURE public.notify_on_status_change();
