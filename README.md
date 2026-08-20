# Panadería Del Horno — Sistema de gestión

App web administrativa en HTML5 + CSS3 + JavaScript (sin frameworks),
con Firebase Authentication y Firestore como backend. Pensada para
alojarse gratis en GitHub Pages.

## 1. Crear el proyecto de Firebase

1. Ve a https://console.firebase.google.com → **Crear proyecto**.
2. Dentro del proyecto: **Authentication → Sign-in method → Correo/contraseña → Habilitar**.
3. **Firestore Database → Crear base de datos** (modo producción, la región más cercana, ej. `us-central`).
4. **Firestore Database → Reglas** → pega el contenido de `firestore.rules` de este proyecto → **Publicar**.
5. **Configuración del proyecto (⚙️) → General → Tus apps → Web (</>)** → registra la app y copia el objeto `firebaseConfig`.
6. Pega esos valores en `js/firebase-config.js` (reemplaza los valores `TU_...`).

## 2. Crear el usuario administrador

1. **Authentication → Users → Add user** → crea el correo/contraseña del administrador. Copia el **UID** que se genera.
2. **Firestore Database → Iniciar colección** → nombre: `usuarios` → ID del documento: **pega el UID copiado** → agrega los campos:
   - `nombre` (string): el nombre del administrador
   - `rol` (string): `administrador`
3. Repite el mismo proceso para el socio (Authentication → Add user), pero en Firestore usa `rol: "socio"`. Después de esto también puedes gestionar usuarios desde el módulo **Usuarios** dentro de la app (solo visible para el administrador).

## 3. Cargar los datos iniciales

Al entrar por primera vez como administrador:

1. **Vehículo** → registra el vehículo (nombre, placa, kilometraje actual).
2. **Rutas** → crea las 6 rutas (Ruta 1 a Ruta 6) y su día asignado.
3. **Productos** → crea el catálogo (nombre, unidad, precio).
4. **Jornada del día** → abre la primera jornada (fecha, ruta, vehículo, km inicial).
5. Desde ahí registra **Inventario**, **Ventas**, **Gastos** y el **Depósito bancario** de esa jornada, y ciérrala cuando esté completa.

## 4. Publicar en GitHub Pages

```bash
git init
git add .
git commit -m "Sistema de gestión Panadería Del Horno"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root)**.
La app quedará disponible en `https://TU_USUARIO.github.io/TU_REPO/`.

> ⚠️ En **Authentication → Settings → Authorized domains**, agrega el dominio
> `TU_USUARIO.github.io` para que el login funcione ahí (localhost ya viene autorizado).

## Estructura del proyecto

```
index.html              → pantalla de inicio de sesión
app.html                → shell de la app (sidebar + vistas)
css/styles.css           → sistema de diseño completo
js/firebase-config.js    → claves de Firebase (edítalo)
js/auth.js               → login/logout y resolución de rol
js/db.js                 → helpers genéricos de Firestore
js/utils.js              → formato, modal, toasts
js/app.js                → router de las vistas
js/views/*.js            → un módulo por sección (dashboard, rutas,
                            productos, inventario, ventas, gastos,
                            vehículo, jornada/cierre, depósitos,
                            reportes, usuarios)
firestore.rules          → reglas de seguridad (admin vs. socio)
```

## Notas de diseño

El rol de **socio** es de solo lectura en toda la app. Esto se aplica
en dos capas: la interfaz oculta los botones de crear/editar/eliminar,
y — lo que realmente importa — `firestore.rules` rechaza cualquier
escritura que no venga de un usuario con `rol: "administrador"`.

Cada "jornada" (un día de operación en una ruta) es el eje central del
sistema: inventario, ventas, gastos y depósito se registran ligados a
su `jornadaId`, y el cierre diario reúne todo eso automáticamente.

## Próximos pasos sugeridos

- Agregar Firebase Storage si luego quieres adjuntar comprobantes/fotos de depósitos.
- Agregar gráficas a Reportes (por ejemplo con Chart.js vía CDN).
- Exportar reportes a Excel/PDF.
