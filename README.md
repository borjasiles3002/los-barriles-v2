# Los Barriles — Sistema de Gestión de Restaurante

App PWA de gestión de restaurante construida con React + TypeScript + Vite + Firebase Firestore + Gemini AI.

## Stack

- **Frontend**: React 19 + TypeScript + Vite 8
- **Backend**: Firebase Firestore (tiempo real) + Firebase Auth + Firebase Storage
- **IA**: Gemini 2.0 Flash (Vision + Chat) vía Vercel Serverless Function
- **Estilos**: Tailwind CSS v3 (dark theme)
- **PWA**: vite-plugin-pwa + Workbox (instalable, funciona offline parcialmente)

## Módulos

| Módulo | Descripción | Roles |
|--------|-------------|-------|
| TPV | Punto de venta móvil, gestión de mesas | admin, manager, camarero |
| Cocina | Monitor en tiempo real de comandas | admin, manager, cocinero |
| Sala | Pantalla completa con estado de mesas | admin, manager, camarero |
| Caja | Cierre diario y resumen de ventas | admin, manager |
| Carta | CRUD de categorías y productos | admin, manager |
| Facturas | Escaneo IA de facturas de proveedor | admin, manager |
| Stock | Gestión de ingredientes y movimientos | admin, manager, cocinero |
| Costes | Escandallos: food cost por plato | admin, manager |
| Alertas | Alertas de precio y stock en tiempo real | admin, manager |
| Chat IA | Asistente Gemini con contexto completo | admin, manager |

## Flujo de IA

```
Foto de factura → Gemini Vision (api/gemini.ts) → JSON estructurado
  → Revisión humana → Guardar /facturas + Firebase Storage
  → Actualizar /stock (cantidades + precios)
  → Si precio subió → Crear /alertas + Recalcular escandallos afectados
```

```
Manager → Chat flotante → Carga contexto Firestore (ventas, stock, alertas)
  → Gemini (api/gemini.ts) → Respuesta con datos reales del restaurante
```

## Requisitos previos

1. Cuenta en [Firebase](https://firebase.google.com)
2. API Key de [Google AI Studio](https://aistudio.google.com/app/apikey) (Gemini)
3. Node.js 18+

## Configuración de Firebase

### 1. Crear proyecto

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un nuevo proyecto
3. Activa **Firestore Database** (modo producción o test)
4. Activa **Authentication → Sign-in method → Email/Password**
5. Activa **Storage** (Firebase Storage para imágenes de facturas)
6. Registra una **Web app** y copia la configuración

### 2. Reglas de Firestore

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

### 3. Reglas de Firebase Storage

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Índices Firestore

No se necesitan índices compuestos para las queries básicas. Para el chat IA (que consulta pedidos por `estado` y `closedAt`), añade este índice en Firestore → Índices → Compuestos:
- Colección: `pedidos`, campo 1: `estado` (Asc), campo 2: `closedAt` (Asc)

## Variables de entorno

Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

```env
# Firebase (prefijo VITE_ → se incluyen en el bundle del cliente)
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=mi-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=mi-proyecto
VITE_FIREBASE_STORAGE_BUCKET=mi-proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_ADMIN_EMAIL=tu@email.com

# Gemini — SIN prefijo VITE_ (solo servidor, nunca expuesta al cliente)
GEMINI_API_KEY=AIza...
```

> **Seguridad**: `GEMINI_API_KEY` no lleva `VITE_` y solo existe en las Vercel Functions (`api/gemini.ts`). El cliente nunca recibe esta clave.

## Desarrollo local

```bash
npm install
npm run dev
```

> En desarrollo local, la ruta `/api/gemini` no existe. Para testear la IA localmente, usa [Vercel CLI](https://vercel.com/docs/cli): `npx vercel dev`.

## Build para producción

```bash
npm run build
npm run preview
```

## Despliegue en Vercel

### Opción A: Vercel Dashboard (recomendado)

1. Sube el repositorio a GitHub
2. Ve a [vercel.com](https://vercel.com) → **Add New Project**
3. Importa el repositorio
4. En **Environment Variables**, añade TODAS las variables (tanto `VITE_*` como `GEMINI_API_KEY`)
5. Haz click en **Deploy**

### Opción B: Vercel CLI

```bash
npm install -g vercel
vercel --prod
```

### Estructura del proyecto para Vercel

```
los-barriles-v2/
├── api/
│   └── gemini.ts      ← Vercel Serverless Function (Node.js 18+)
├── src/               ← Frontend React (Vite build → dist/)
├── dist/              ← Output del build (servido por Vercel)
└── vercel.json        ← Configuración de routing
```

Vercel detecta automáticamente:
- `api/*.ts` → Serverless Functions
- `dist/` → Static site output
- `vercel.json` → Reescrituras para SPA routing

## Primer uso (seed automático)

Al iniciar sesión por primera vez, la app carga automáticamente:
- **23 mesas** (Mesa 1–20 + Terraza 1, Terraza 2, Barra)
- **6 categorías**: Entrantes, Carnes, Pescados, Postres, Bebidas, Cafés
- **34 productos** con precios

## Roles de usuario

| Rol | Módulos accesibles |
|-----|-------------------|
| `admin` | Todo (TPV, Cocina, Sala, Caja, Carta, Facturas, Stock, Costes, Alertas, Chat IA) |
| `manager` | Todo |
| `camarero` | TPV + Sala |
| `cocinero` | Cocina + Stock |

El primer login con `VITE_ADMIN_EMAIL` recibe `admin` automáticamente. El resto reciben `camarero`. Cambia el rol editando `/usuarios/{uid}.role` en Firestore Console.

## Estructura Firestore

```
/mesas/{id}           numero, nombre, estado, pedidoActivo?
/pedidos/{id}         mesaId, mesaNombre, estado, lineas[], total, createdAt, closedAt?
/carta/{id}           nombre, orden  (categorías)
/productos/{id}       categoriaId, nombre, precio, descripcion, disponible
/notificaciones/{id}  tipo, mesaId, pedidoId, mesaNombre, leido, createdAt
/cierres/{id}         fecha, total, numeroPedidos, ticketMedio, pedidosIds[], createdAt
/usuarios/{uid}       uid, email, role, nombre

// Módulos IA/Stock/Escandallos
/facturas/{id}        proveedor, fecha, numero_factura, productos[], subtotal, iva, total,
                      imagenUrl, procesada, createdAt
/stock/{id}           nombre, cantidad, unidad, stockMinimo, ultimoPrecio, proveedor,
                      ultimaActualizacion
/stock/{id}/movimientos/{id}  tipo, cantidad, motivo, fecha, facturaId?
/escandallos/{productoId}     productoNombre, ingredientes[], costeTotal, precioVenta,
                               margen, foodCostPct, updatedAt
/alertas/{id}         tipo, mensaje, datos, leido, createdAt
```

## Flujo completo (operación diaria)

1. **Mañana**: Camarero abre mesa libre → se crea pedido
2. **Durante servicio**: Camarero añade productos → cocina ve comandas → marca como listo
3. **Cobro**: Camarero cobra → mesa queda libre
4. **Facturas**: Manager escanea factura proveedor → Gemini extrae datos → stock actualizado
5. **Alertas**: Si precio subió → alerta automática + recálculo de escandallos afectados
6. **Análisis**: Manager pregunta al Chat IA "¿cuáles son mis platos menos rentables?"
7. **Cierre**: Manager realiza cierre de caja con resumen del día
