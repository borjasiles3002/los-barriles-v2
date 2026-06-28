# Los Barriles — Sistema de Gestión de Restaurante

App PWA de gestión de restaurante construida con React + TypeScript + Vite + Firebase Firestore.

## Stack

- **Frontend**: React 19 + TypeScript + Vite 8
- **Backend**: Firebase Firestore (tiempo real) + Firebase Auth
- **Estilos**: Tailwind CSS v3 (dark theme)
- **PWA**: vite-plugin-pwa + Workbox (instalable, funciona offline parcialmente)

## Módulos

| Módulo | Roles |
|--------|-------|
| TPV (punto de venta, móvil) | admin, manager, camarero |
| Cocina (monitor tiempo real) | admin, manager, cocinero |
| Sala (monitor pantalla completa) | admin, manager, camarero |
| Caja (cierre diario) | admin, manager |
| Carta (gestión menú) | admin, manager |

## Requisitos previos

1. Cuenta en [Firebase](https://firebase.google.com)
2. Node.js 18+

## Configuración de Firebase

### 1. Crear proyecto

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un nuevo proyecto
3. Activa **Firestore Database** (modo producción o test)
4. Activa **Authentication → Sign-in method → Email/Password**
5. Registra una **Web app** y copia la configuración

### 2. Reglas de Firestore recomendadas

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 3. Índices

No se necesitan índices compuestos. Todas las queries usan un solo campo.

## Variables de entorno

Copia `.env.example` a `.env` y rellena con tu configuración de Firebase:

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=mi-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=mi-proyecto
VITE_FIREBASE_STORAGE_BUCKET=mi-proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# El primer usuario que inicie sesión con este email recibirá el rol 'admin'.
# Los demás recibirán 'camarero' por defecto.
VITE_ADMIN_EMAIL=tu@email.com
```

## Desarrollo local

```bash
npm install
npm run dev
```

## Build para producción

```bash
npm run build
npm run preview  # previsualizar el build
```

## Despliegue en Vercel

### Opción A: Vercel Dashboard (recomendado)

1. Sube el repositorio a GitHub
2. Ve a [vercel.com](https://vercel.com) → **Add New Project**
3. Importa el repositorio
4. En **Environment Variables**, añade todas las variables `VITE_*`
5. Haz click en **Deploy**

### Opción B: Vercel CLI

```bash
npm install -g vercel
vercel --prod
```

Configura las variables de entorno en Vercel Dashboard → Project → Settings → Environment Variables.

> **Nota**: Las variables deben empezar por `VITE_` para que Vite las incluya en el bundle cliente.

## Primer uso (seed automático)

Al iniciar sesión por primera vez, la app detecta Firestore vacío y carga automáticamente:
- **23 mesas** (Mesa 1–20 + Terraza 1, Terraza 2, Barra)
- **6 categorías**: Entrantes, Carnes, Pescados, Postres, Bebidas, Cafés
- **34 productos** con precios

## Roles de usuario

Crea usuarios en Firebase Authentication (email/password). El rol se asigna en `/usuarios/{uid}`:

| Rol | Acceso |
|-----|--------|
| `admin` | Todo |
| `manager` | Todo |
| `camarero` | TPV + Sala |
| `cocinero` | Cocina |

El primer login con `VITE_ADMIN_EMAIL` recibe `admin` automáticamente. El resto reciben `camarero`. Para cambiar un rol, edita el campo `role` en `/usuarios/{uid}` desde la consola de Firestore.

## Estructura Firestore

```
/mesas/{id}           numero, nombre, estado, pedidoActivo?
/pedidos/{id}         mesaId, mesaNombre, estado, lineas[], total, createdAt, closedAt?
/carta/{id}           nombre, orden  (categorías)
/productos/{id}       categoriaId, nombre, precio, descripcion, disponible
/notificaciones/{id}  tipo, mesaId, pedidoId, mesaNombre, leido, createdAt
/cierres/{id}         fecha, total, numeroPedidos, ticketMedio, pedidosIds[], createdAt
/usuarios/{uid}       uid, email, role, nombre
```

## Flujo completo

1. Camarero abre mesa libre → se crea pedido en Firestore, mesa pasa a `ocupada`
2. Camarero añade productos → se acumulan en `lineas[]` con transacción atómica
3. Camarero envía a cocina → pedido pasa a `en_cocina`
4. Cocinero marca líneas como listas → cuando todas están listas, pedido pasa a `listo` y se crea notificación
5. Camarero ve banner de notificación → puede cobrar
6. Camarero cobra → pedido pasa a `cerrado`, mesa vuelve a `libre`
7. Manager realiza cierre de caja → se registra resumen en `/cierres`
