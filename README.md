# Los Barriles — Sistema de Gestión de Restaurante

App PWA de gestión completa de restaurante: TPV, cocina, sala, finanzas y análisis con IA.

## Stack

- **Frontend**: React 19 + TypeScript + Vite 8
- **Backend**: Firebase Firestore (tiempo real) + Firebase Auth + Firebase Storage
- **IA**: Gemini 2.0 Flash (Vision + Chat + Informes) vía Vercel Serverless Function
- **Estilos**: Tailwind CSS v3 (dark theme, mobile-first)
- **Gráficas**: Recharts
- **PDFs**: jsPDF
- **PWA**: vite-plugin-pwa + Workbox (instalable, offline parcial)

## Módulos

| # | Módulo | Descripción | Roles |
|---|--------|-------------|-------|
| 1 | TPV | Punto de venta móvil, gestión de mesas + modal de cobro con método de pago | admin, manager, camarero |
| 2 | Cocina | Monitor en tiempo real de comandas | admin, manager, cocinero |
| 3 | Sala | Pantalla completa con estado de mesas | admin, manager, camarero |
| 4 | Carta | CRUD de categorías y productos | admin, manager |
| 5 | Facturas IA | Escaneo Gemini Vision de facturas → stock automático + gasto automático | admin, manager |
| 6 | Stock | Gestión de ingredientes, movimientos y alertas de stock | admin, manager, cocinero |
| 7 | Costes | Escandallos: food cost por plato | admin, manager |
| 8 | Alertas | Alertas de precio y stock en tiempo real | admin, manager |
| 9 | Chat IA | Asistente Gemini con contexto completo del restaurante | admin, manager |
| 10 | Dashboard | KPIs en tiempo real + 4 gráficas Recharts + objetivo mensual | admin, manager |
| 11 | Ingresos | Registro automático al cobrar cada pedido | admin, manager |
| 12 | Gastos | Gastos operativos manuales + automáticos desde facturas | admin, manager |
| 13 | Informes IA | Informes diario/semanal/mensual/anual generados con Gemini + PDF | admin, manager |
| 14 | Rentabilidad | Cruce ventas × escandallos → ranking de rentabilidad por plato | admin, manager |
| 15 | Cierre | Arqueo de caja (efectivo esperado vs real) + exportar PDF | admin, manager |

## Flujo financiero automático

```
Camarero cobra pedido → Modal método de pago (efectivo/tarjeta/bizum/invitación/otros)
  → cerrarPedido() → registrarIngreso() guardado en /ingresos

Manager escanea factura proveedor → Gemini extrae datos → stock actualizado
  → Se crea automáticamente un /gastos con categoría 'compras'

Manager abre Informes → Selecciona período → carga datos Firestore
  → Gemini genera análisis narrativo → Exportar PDF con jsPDF
```

## Flujo de IA

```
Foto de factura → Gemini Vision (api/gemini.ts) → JSON estructurado
  → /facturas + Firebase Storage
  → /stock (cantidades + precios)
  → Si precio subió → /alertas + recálculo escandallos
  → /gastos (categoría: compras) ← NUEVO

Manager → Dashboard → KPIs tiempo real + 4 gráficas Recharts

Manager → Informes IA → getDatos{Diarios|Semanales|Mensuales|Anuales}()
  → Gemini (api/gemini.ts action='informe') → Análisis narrativo
  → Exportar PDF (jsPDF)

Manager → Rentabilidad → Escandallos × Ingresos → Ranking beneficio bruto
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
5. Activa **Storage** (para imágenes de facturas)
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

## Variables de entorno

Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

```env
# Firebase (prefijo VITE_ → bundle del cliente)
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=mi-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=mi-proyecto
VITE_FIREBASE_STORAGE_BUCKET=mi-proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_ADMIN_EMAIL=tu@email.com

# Gemini — SIN prefijo VITE_ (solo servidor, nunca al cliente)
GEMINI_API_KEY=AIza...
```

> **Seguridad**: `GEMINI_API_KEY` no lleva `VITE_` y solo existe en las Vercel Functions. El cliente nunca recibe esta clave.

## Desarrollo local

```bash
npm install
npm run dev
```

> Para testear la IA localmente: `npx vercel dev` (necesitas Vercel CLI).

## Build para producción

```bash
npm run build   # tsc + vite build (sin errores TypeScript)
npm run preview
```

## Despliegue en Vercel

### Dashboard (recomendado)

1. Sube el repositorio a GitHub
2. Ve a [vercel.com](https://vercel.com) → **Add New Project**
3. Importa el repositorio
4. En **Environment Variables**, añade **todas** las variables (tanto `VITE_*` como `GEMINI_API_KEY`)
5. Deploy

### Vercel CLI

```bash
npx vercel --prod
```

## Estructura del proyecto

```
los-barriles-v2/
├── api/
│   └── gemini.ts          ← Vercel Serverless (analyze | chat | informe)
├── src/
│   ├── components/        ← Todas las vistas y componentes UI
│   ├── contexts/          ← AuthContext
│   ├── hooks/             ← useAlertas, useIngresos, useGastos, useCarta…
│   ├── services/          ← Firebase CRUD + lógica de negocio
│   ├── utils/
│   │   └── dates.ts       ← Utilidades de fechas e ISO weeks
│   ├── types.ts           ← Todos los tipos TypeScript
│   └── App.tsx            ← Router + NavBar + Layout
└── vercel.json
```

## Primer uso (seed automático)

Al iniciar sesión por primera vez la app carga:
- **23 mesas** (Mesa 1–20 + Terraza 1, Terraza 2, Barra)
- **6 categorías**: Entrantes, Carnes, Pescados, Postres, Bebidas, Cafés
- **34 productos** con precios

## Roles de usuario

| Rol | Módulos accesibles |
|-----|-------------------|
| `admin` | Todo (13 tabs) |
| `manager` | Todo (13 tabs) |
| `camarero` | TPV + Sala |
| `cocinero` | Cocina + Stock |

El primer login con `VITE_ADMIN_EMAIL` recibe `admin` automáticamente. El resto reciben `camarero`. Cambia el rol en Firestore Console → `/usuarios/{uid}.role`.

## Estructura Firestore

```
/mesas/{id}              numero, nombre, estado, pedidoActivo?
/pedidos/{id}            mesaId, mesaNombre, estado, lineas[], total, createdAt, closedAt?
/carta/{id}              nombre, orden
/productos/{id}          categoriaId, nombre, precio, descripcion, disponible
/notificaciones/{id}     tipo, mesaId, pedidoId, mesaNombre, leido, createdAt
/usuarios/{uid}          uid, email, role, nombre

// Facturas & Stock
/facturas/{id}           proveedor, fecha, numero_factura, productos[], subtotal, iva, total,
                         imagenUrl, procesada, createdAt
/stock/{id}              nombre, cantidad, unidad, stockMinimo, ultimoPrecio,
                         proveedor, ultimaActualizacion
/stock/{id}/movimientos/ tipo, cantidad, motivo, fecha, facturaId?
/escandallos/{productoId} productoNombre, ingredientes[], costeTotal, precioVenta,
                           margen, foodCostPct, updatedAt
/alertas/{id}            tipo, mensaje, datos, leido, createdAt

// Módulos financieros
/ingresos/{id}           fecha, hora, mesaId, mesaNombre, pedidoId, lineas[],
                         subtotal, iva, total, metodoPago, camareroId, camareroNombre
/gastos/{id}             fecha, descripcion, categoria, importe, proveedor?,
                         facturaId?, createdAt
/cierresCompletos/{id}   fecha, totalIngresos, totalGastos, beneficioNeto,
                         numeroPedidos, ticketMedio, efectivoEsperado, efectivoReal,
                         diferencia, ingresosPorMetodo, createdAt
/objetivos/{YYYY-MM}     ventasMensuales
```

## Flujo operativo diario

1. **Servicio**: Camarero abre mesa → añade productos → envía a cocina
2. **Cocina**: Cocinero ve comandas en tiempo real → marca como listo
3. **Cobro**: Camarero cobra → **selecciona método de pago** → pedido cerrado → ingreso registrado automáticamente
4. **Facturas**: Manager escanea factura → Gemini extrae datos → stock y gasto actualizados
5. **Fin de día**: Manager abre Cierre → introduce efectivo real → arqueo → PDF
6. **Análisis**: Manager abre Informes → selecciona período → Gemini genera análisis → PDF
7. **Rentabilidad**: Manager cruza ventas × escandallos → ranking de platos más rentables
