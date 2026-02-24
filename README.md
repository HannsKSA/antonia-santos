## Configuración Inicial

Para empezar a usar el sistema y probar las funcionalidades de administrador:

1.  **Registro:** Ve a la página de [Registro](http://localhost:3000/register) y crea una cuenta con tu correo (ej: `hannssa@gmail.com`).
2.  **Configurar Super Admin:** Una vez registrado, ejecuta el siguiente comando SQL en el **SQL Editor de Supabase** para darte permisos totales:

```sql
UPDATE profiles 
SET role = 'super_admin', status = 'approved' 
WHERE id = (SELECT id FROM auth.users WHERE email = 'tu-correo@gmail.com');
```

3.  **Grupos:** Asegúrate de tener grupos creados para que aparezcan en el registro:

```sql
INSERT INTO groups (name) VALUES ('Grado 1-1'), ('Grado 1-2'), ('General');
```

## Estructura del Proyecto

- `/src/app/register`: Formulario de registro multiactor.
- `/src/app/login`: Acceso controlado por estado de aprobación.
- `/src/app/dashboard`: Panel de gestión para Docentes/Admin y Feed para usuarios.

## Scripts Disponibles

Primero, corre el servidor de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.
