-- Semilla para crear el Super Usuario Inicial
-- Nota: Las contraseñas en auth.users están encriptadas. 
-- Este script prepara el perfil, pero el usuario debe ser creado vía Auth API o manualmente en el panel de Supabase.

-- 1. Insertar el perfil de Super Admin (se vinculará cuando el UUID exista en auth.users)
-- Como no tenemos el UUID todavía, creamos una función que podamos llamar o una tabla de configuración.

-- Sugerencia: Inserta esto en el SQL Editor de Supabase después de crear el usuario manual:
/*
UPDATE profiles 
SET role = 'super_admin', status = 'approved' 
WHERE id = (SELECT id FROM auth.users WHERE email = 'hannssa@gmail.com');
*/

-- Opcional: Crear el primer grupo 'General'
INSERT INTO groups (name) VALUES ('General') ON CONFLICT (name) DO NOTHING;
INSERT INTO groups (name) VALUES ('Docentes') ON CONFLICT (name) DO NOTHING;
