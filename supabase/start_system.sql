-- ==========================================
-- 🚀 SCRIPT DE INICIO: IE ANTONIA SANTOS
-- Copia y pega este contenido en el SQL Editor de Supabase
-- ==========================================

-- 1. ELIMINAR TODO LO ANTERIOR (Opcional, limpiar antes de empezar)
-- DROP TABLE IF EXISTS post_reads, votes, poll_options, comments, notifications, posts, user_groups, groups, profiles CASCADE;
-- DROP TYPE IF EXISTS user_role, user_sub_role, user_status, content_type, multimedia_type CASCADE;

-- 2. CREACIÓN DE TIPOS ENUM
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'teacher', 'user');
    CREATE TYPE user_sub_role AS ENUM ('representative', 'student', 'teacher');
    CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected');
    CREATE TYPE content_type AS ENUM ('news', 'event', 'survey', 'proposal');
    CREATE TYPE multimedia_type AS ENUM ('internal', 'external');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. TABLA DE PERFILES
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

-- 4. TABLA DE GRUPOS (GRADOS)
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA DE SUBSCRIPCIONES (N:M)
CREATE TABLE IF NOT EXISTS user_groups (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

-- 6. TABLA DE POSTS (NOTICIAS/EVENTOS)
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

-- 9. CONFIGURACIÓN DEL SUPER USUARIO (hannssa@gmail.com)
-- Nota: Ejecuta esto DESPUÉS de registrarte en la web.
/*
-- PASO A: Convertir en Super Admin
UPDATE profiles 
SET role = 'super_admin', status = 'approved' 
WHERE id = (SELECT id FROM auth.users WHERE email = 'hannssa@gmail.com');

-- PASO B: Vincular al grupo Administración
INSERT INTO user_groups (user_id, group_id)
SELECT 
    (SELECT id FROM auth.users WHERE email = 'hannssa@gmail.com'),
    (SELECT id FROM groups WHERE name = 'Administración')
ON CONFLICT DO NOTHING;
*/

-- 10. TRIGGER PARA CREAR PERFIL AUTOMÁTICAMENTE
-- Esto asegura que cada vez que alguien se registre en Auth, tenga un perfil en la tabla profiles.
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
