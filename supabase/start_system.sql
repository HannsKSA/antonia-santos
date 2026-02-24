-- ==========================================
-- 🚀 SCRIPT DE INICIO: IE ANTONIA SANTOS
-- Copia y pega este contenido en el SQL Editor de Supabase
-- ==========================================

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

-- 12. POLÍTICAS RLS PARA COMENTARIOS Y VOTOS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can comment on posts" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes are viewable by everyone" ON proposal_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote once per post" ON proposal_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their vote" ON proposal_votes FOR UPDATE USING (auth.uid() = user_id);

-- 13. TRIGGER PARA CREAR PERFIL AUTOMÁTICAMENTE (Movido al final)
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

