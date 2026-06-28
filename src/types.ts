export type Role = 'admin' | 'manager' | 'camarero' | 'cocinero';
export type MesaEstado = 'libre' | 'ocupada' | 'cuenta_pedida';
export type PedidoEstado = 'abierto' | 'en_cocina' | 'listo' | 'cuenta_pedida' | 'cerrado';
export type LineaEstado = 'pendiente' | 'en_preparacion' | 'listo';

export interface AppUser {
  uid: string;
  email: string;
  role: Role;
  nombre: string;
}

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
