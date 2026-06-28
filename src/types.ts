// ─── Auth / Users ─────────────────────────────────────────────────────────────

export type Role = 'admin' | 'manager' | 'camarero' | 'cocinero';

export interface AppUser {
  uid: string;
  email: string;
  role: Role;
  nombre: string;
}

// ─── Mesas & Pedidos ──────────────────────────────────────────────────────────

export type MesaEstado = 'libre' | 'ocupada' | 'cuenta_pedida';
export type PedidoEstado = 'abierto' | 'en_cocina' | 'listo' | 'cuenta_pedida' | 'cerrado';
export type LineaEstado = 'pendiente' | 'en_preparacion' | 'listo';

export interface Mesa {
  id: string;
  numero: number;
  nombre: string;
  estado: MesaEstado;
  pedidoActivo?: string | null;
}

export interface LineaPedido {
  id: string;
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  estado: LineaEstado;
  notas?: string;
}

export interface Pedido {
  id: string;
  mesaId: string;
  mesaNombre: string;
  estado: PedidoEstado;
  lineas: LineaPedido[];
  total: number;
  createdAt: string;
  closedAt?: string;
  camareroId?: string;
  camareroNombre?: string;
}

// ─── Carta ────────────────────────────────────────────────────────────────────

export interface Categoria {
  id: string;
  nombre: string;
  orden: number;
}

export interface Producto {
  id: string;
  categoriaId: string;
  nombre: string;
  precio: number;
  descripcion: string;
  disponible: boolean;
}

// ─── Notificaciones & Cierres ─────────────────────────────────────────────────

export interface Notificacion {
  id: string;
  tipo: 'pedido_listo';
  mesaId: string;
  pedidoId: string;
  mesaNombre: string;
  leido: boolean;
  createdAt: string;
}

export interface Cierre {
  id: string;
  fecha: string;
  total: number;
  numeroPedidos: number;
  ticketMedio: number;
  createdAt: string;
  pedidosIds: string[];
}

// ─── Módulo Facturas (IA) ─────────────────────────────────────────────────────

export interface FacturaProducto {
  nombre: string;
  cantidad: number;
  unidad: string;
  precio_unidad: number;
  precio_total: number;
}

export interface Factura {
  id: string;
  proveedor: string;
  fecha: string;
  numero_factura: string;
  productos: FacturaProducto[];
  subtotal: number;
  iva: number;
  total: number;
  imagenUrl: string;
  procesada: boolean;
  createdAt: string;
}

// ─── Módulo Stock ─────────────────────────────────────────────────────────────

export interface StockItem {
  id: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  stockMinimo: number;
  ultimoPrecio: number;
  proveedor: string;
  ultimaActualizacion: string;
}

export interface StockMovimiento {
  id: string;
  tipo: 'entrada' | 'salida';
  cantidad: number;
  motivo: string;
  fecha: string;
  facturaId?: string;
}

// ─── Módulo Escandallos ───────────────────────────────────────────────────────

export interface EscandallIngrediente {
  stockId: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
}

export interface Escandallo {
  id: string;
  productoNombre: string;
  ingredientes: EscandallIngrediente[];
  costeTotal: number;
  precioVenta: number;
  margen: number;
  foodCostPct: number;
  updatedAt: string;
}

// ─── Módulo Alertas ───────────────────────────────────────────────────────────

export type AlertaTipo = 'precio_subida' | 'stock_minimo' | 'food_cost';

export interface Alerta {
  id: string;
  tipo: AlertaTipo;
  mensaje: string;
  datos: Record<string, unknown>;
  leido: boolean;
  createdAt: string;
}

// ─── Módulo Proveedores ───────────────────────────────────────────────────────

export interface HistorialPrecio {
  precio: number;
  fecha: string;
  facturaId: string;
}

export interface ProveedorProducto {
  nombre: string;
  ultimoPrecio: number;
  unidad: string;
  historialPrecios: HistorialPrecio[];
}

export interface Proveedor {
  id: string;
  nombre: string;
  productos: ProveedorProducto[];
}

// ─── Chat IA ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
