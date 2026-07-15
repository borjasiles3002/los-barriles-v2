// ─── Auth / Users ─────────────────────────────────────────────────────────────

// admin = alias de gerente (retrocompatibilidad)
export type Role = 'gerente' | 'admin' | 'manager' | 'cocinero' | 'camarero' | 'barman';

export function esGerente(role: Role): boolean {
  return role === 'gerente' || role === 'admin';
}

export function esAdmin(role: Role): boolean {
  return role === 'gerente' || role === 'admin' || role === 'manager';
}

export interface AppUser {
  uid: string;
  email: string;
  role: Role;
  nombre: string;
  apellidos?: string;
  telefono?: string;
  pinHash?: string;
  activo?: boolean;
  fechaAlta?: string;
  avatar?: string;
}

// ─── Personal ─────────────────────────────────────────────────────────────────

export interface Trabajador extends AppUser {
  // mismos campos que AppUser, alias semántico
}

export interface Fichaje {
  id: string;
  usuarioId: string;
  nombre: string;
  tipo: 'entrada' | 'salida';
  timestamp: string;
  fecha: string;
  hora: string;
}

export interface Turno {
  id: string;
  usuarioId: string;
  nombre: string;
  fecha: string;
  entrada: string;
  salida?: string;
  horasTrabajadas?: number;
  completo: boolean;
  incidencia?: string;
}

// ─── Tareas ───────────────────────────────────────────────────────────────────

export type Prioridad   = 'alta' | 'media' | 'baja';
export type EstadoTarea = 'pendiente' | 'en_progreso' | 'completada';

export interface ChecklistItem {
  id: string;
  texto: string;
  completado: boolean;
}

export interface Tarea {
  id: string;
  titulo: string;
  descripcion?: string;
  asignadoA: string;
  asignadoANombre: string;
  asignadoPor: string;
  fechaLimite?: string;
  prioridad: Prioridad;
  estado: EstadoTarea;
  checklist: ChecklistItem[];
  creadaEn: string;
  completadaEn?: string;
}

// ─── Mesas & Pedidos ──────────────────────────────────────────────────────────

export type MesaEstado    = 'libre' | 'ocupada' | 'cuenta_pedida';
export type PedidoEstado  = 'abierto' | 'en_cocina' | 'listo' | 'cuenta_pedida' | 'cerrado' | 'cancelado';
export type LineaEstado   = 'pendiente' | 'en_preparacion' | 'listo' | 'servido';
export type DestinoProducto = 'barra' | 'cocina' | 'ambos';
export type TipoIva = 'reducido' | 'superreducido' | 'normal';

export const IVA_RATES: Record<TipoIva, number> = {
  reducido:      0.10,
  superreducido: 0.04,
  normal:        0.21,
};

export interface Mesa {
  id: string;
  numero: number;
  nombre: string;
  estado: MesaEstado;
  pedidoActivo?: string | null;
  comensales?: number;
  posX?: number;   // 0–100 % del contenedor del mapa de sala
  posY?: number;   // 0–100 % del contenedor del mapa de sala
}

export interface LineaPedido {
  id: string;
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  estado: LineaEstado;
  destino: DestinoProducto;
  notas?: string;
  tipoIva?: TipoIva;
  controlStock?: boolean;
  esManual?: boolean;
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
  clienteId?: string;
  clienteNombre?: string;
  canceladoAt?: string;
  canceladoPor?: string;
  canceladoNombre?: string;
  canceladoMotivo?: string;
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
  destino?: DestinoProducto;
  tipoIva?: TipoIva;
  controlStock?: boolean;
  stockActual?: number | null;
}

// ─── Notificaciones & Cierres ─────────────────────────────────────────────────

export interface Notificacion {
  id: string;
  tipo: 'pedido_listo' | 'cuenta_pedida' | 'stock_agotado' | 'stock_bajo' | 'nueva_reserva';
  mensaje?: string;
  // Pedido notifications
  mesaId?: string;
  pedidoId?: string;
  mesaNombre?: string;
  // Stock notifications
  productoId?: string;
  productoNombre?: string;
  stockActual?: number;
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

// ─── Clientes ─────────────────────────────────────────────────────────────────

export interface Cliente {
  id: string;
  nombre: string;
  apellidos: string;
  empresa?: string;
  nif?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  cp?: string;
  ciudad?: string;
  notas?: string;
  totalVisitas: number;
  totalGastado: number;
  ultimaVisita?: string;
  creadoEn: string;
}

// ─── Facturas emitidas ────────────────────────────────────────────────────────

export interface LineaFactura {
  nombre: string;
  cantidad: number;
  precioConIva: number;
  base: number;
  iva: number;
  tipoIva: TipoIva;
}

export interface FacturaEmitida {
  id: string;
  numero: string;
  fecha: string;
  clienteId?: string;
  clienteNombre?: string;
  clienteNif?: string;
  clienteDireccion?: string;
  lineas: LineaFactura[];
  bases: Record<TipoIva, number>;
  cuotasIva: Record<TipoIva, number>;
  total: number;
  pedidoId: string;
  mesaNombre: string;
  creadaEn: string;
}

// ─── Configuración restaurante ────────────────────────────────────────────────

export interface ConfigRestaurante {
  nombre: string;
  nif: string;
  direccion: string;
  cp: string;
  ciudad: string;
  telefono: string;
  email: string;
  logo?: string;
  iban?: string;
}

// ─── Stock diario ─────────────────────────────────────────────────────────────

export interface StockDiarioItem {
  productoId: string;
  nombre: string;
  inicial: number;
}

export interface StockDiario {
  id: string;
  fecha: string;
  items: Record<string, StockDiarioItem>;
}

// ─── Módulo Ingresos ──────────────────────────────────────────────────────────

export type MetodoPago = 'efectivo' | 'tarjeta' | 'bizum' | 'invitacion' | 'otros';

export interface Ingreso {
  id: string;
  fecha: string;
  hora: string;
  mesaId: string;
  mesaNombre: string;
  pedidoId: string;
  lineas: LineaPedido[];
  subtotal: number;
  iva: number;
  total: number;
  metodoPago: MetodoPago;
  camareroId: string;
  camareroNombre: string;
}

// ─── Módulo Gastos ────────────────────────────────────────────────────────────

export type CategoriaGasto =
  | 'compras'
  | 'personal'
  | 'suministros'
  | 'alquiler'
  | 'mantenimiento'
  | 'marketing'
  | 'otros';

export interface Gasto {
  id: string;
  fecha: string;
  descripcion: string;
  categoria: CategoriaGasto;
  importe: number;
  proveedor?: string;
  facturaId?: string;
  createdAt: string;
}

// ─── Cierre completo ──────────────────────────────────────────────────────────

export interface CierreCompleto {
  id: string;
  fecha: string;
  totalIngresos: number;
  totalGastos: number;
  beneficioNeto: number;
  numeroPedidos: number;
  ticketMedio: number;
  efectivoEsperado: number;
  efectivoReal: number;
  diferencia: number;
  ingresosPorMetodo: Partial<Record<MetodoPago, number>>;
  createdAt: string;
}

// ─── Objetivo mensual ─────────────────────────────────────────────────────────

export interface Objetivo {
  id: string;
  ventasMensuales: number;
}

// ─── Impresión (QZ Tray) ──────────────────────────────────────────────────────

export type TipoColaImpresion   = 'cocina' | 'barra' | 'ticket';
export type EstadoColaImpresion = 'pendiente' | 'procesado' | 'error';

export interface ColaImpresion {
  id:           string;
  tipo:         TipoColaImpresion;
  mesaNombre:   string;
  pedidoId:     string;
  lineas:       LineaPedido[];
  total?:       number;
  estado:       EstadoColaImpresion;
  createdAt:    string;
  procesadoAt?: string;
  errorMsg?:    string;
}

export interface ConfigImpresoras {
  impresoraCocina: string;
  impresoraBarra:  string;
}

// ─── Módulo Reservas ──────────────────────────────────────────────────────────

export type EstadoReserva = 'pendiente' | 'confirmada' | 'sentada' | 'completada' | 'no_show' | 'cancelada';
export type OrigenReserva = 'telefono' | 'presencial' | 'web';
export type ZonaReserva   = 'interior' | 'terraza' | 'barra';

export interface Reserva {
  id: string;
  nombre: string;
  telefono: string;
  email?: string;
  clienteId?: string;
  fecha: string;
  hora: string;
  comensales: number;
  mesaId?: string;
  mesaNombre?: string;
  zona?: ZonaReserva;
  estado: EstadoReserva;
  notas?: string;
  origen: OrigenReserva;
  creadaPor: string;
  createdAt: string;
}

export interface ConfigReservas {
  capacidadComida: number;
  capacidadCena: number;
  horaInicioComida: string;
  horaFinComida: string;
  horaInicioCena: string;
  horaFinCena: string;
}
