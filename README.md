# Suite Taller Celulares Pro - Web Licensing API

Esta es la API Web de Licenciamiento y Comercialización para el software de administración de taller de celulares. Permite controlar la distribución mediante el registro de usuarios, validación online bloqueada por Hardware ID (HWID), recuperación de contraseña y administración de licencias.

## Estructura del Proyecto

* **`server.js`**: Backend escrito en Node.js y Express.
* **`api_php.php`**: Versión alternativa en PHP nativo, lista para ser cargada en un hosting tradicional con cPanel.
* **`licenses.db.json`**: Base de datos local autoadministrada en formato JSON (Ignorada en git por seguridad).

---

## Opción 1: Despliegue con PHP (Recomendada para Hosting Compartido)

1. Sube el archivo `api_php.php` a tu servidor (por ejemplo, en la carpeta `/public_html/api_php.php`).
2. La base de datos `licenses.db.json` se creará automáticamente en la misma carpeta cuando se realice la primera petición.
3. Configura la URL en el panel de **APIs & Licencias** de tu software:
   `https://tudominio.com/api_php.php`

---

## Opción 2: Despliegue con Node.js & Express

### Requisitos
* Node.js v16 o superior instalado.

### Instalación
1. Descarga el repositorio en tu servidor.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor de licencias:
   ```bash
   npm start
   ```
   El servidor correrá en `http://localhost:5000` (o el puerto definido en la variable de entorno `PORT`).

---

## Endpoints de la API

### 1. Registro de Usuario (`POST /api/register`)
Registra una cuenta de prueba de 15 días.
```json
{
  "email": "correo@cliente.com",
  "passwordHash": "SHA256_HASH_DE_CONTRASENA",
  "hwid": "HWID_UNICO_DE_PC",
  "securityAnswerHash": "SHA256_HASH_DE_RESPUESTA"
}
```

### 2. Login y Activación (`POST /api/login`)
Valida la licencia en línea y la coincidencia de HWID.
```json
{
  "email": "correo@cliente.com",
  "passwordHash": "SHA256_HASH_DE_CONTRASENA",
  "hwid": "HWID_UNICO_DE_PC"
}
```

### 3. Recuperar Contraseña (`POST /api/reset-password`)
```json
{
  "email": "correo@cliente.com",
  "securityAnswerHash": "SHA256_HASH_DE_RESPUESTA",
  "newPasswordHash": "SHA256_HASH_NUEVA_CONTRASENA"
}
```

### 4. Administración de Licencias (`POST /api/admin/licenses`)
Permite extender licencias o liberar HWID. Requiere la clave secreta `ADMIN_TALLER_CELULARES_PRO_SECURE`.
```json
{
  "email": "correo@cliente.com",
  "daysToAdd": 30,
  "resetHwid": true,
  "adminSecret": "ADMIN_TALLER_CELULARES_PRO_SECURE"
}
```
