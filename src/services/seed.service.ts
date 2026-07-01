import {
  collection, doc, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

const MESAS = [
  ...Array.from({ length: 20 }, (_, i) => ({
    numero: i + 1,
    nombre: `Mesa ${i + 1}`,
  })),
  { numero: 21, nombre: 'Terraza 1' },
  { numero: 22, nombre: 'Terraza 2' },
  { numero: 23, nombre: 'Barra' },
];

const CATEGORIAS = [
  { id: 'entrantes',  nombre: 'Entrantes',  orden: 1 },
  { id: 'carnes',     nombre: 'Carnes',     orden: 2 },
  { id: 'pescados',   nombre: 'Pescados',   orden: 3 },
  { id: 'postres',    nombre: 'Postres',    orden: 4 },
  { id: 'bebidas',    nombre: 'Bebidas',    orden: 5 },
  { id: 'cafes',      nombre: 'Cafés',      orden: 6 },
];

const PRODUCTOS = [
  // Entrantes → cocina
  { categoriaId: 'entrantes', nombre: 'Pan con tomate',      precio: 3.50,  descripcion: 'Pan artesano con tomate natural y aceite de oliva', disponible: true, destino: 'cocina' },
  { categoriaId: 'entrantes', nombre: 'Jamón ibérico',       precio: 14.00, descripcion: 'Jamón ibérico de bellota, cortado a mano',          disponible: true, destino: 'cocina' },
  { categoriaId: 'entrantes', nombre: 'Tabla de quesos',     precio: 11.00, descripcion: 'Selección de quesos artesanos con mermelada',        disponible: true, destino: 'cocina' },
  { categoriaId: 'entrantes', nombre: 'Croquetas caseras',   precio: 8.00,  descripcion: 'Croquetas de jamón ibérico (6 uds)',                 disponible: true, destino: 'cocina' },
  { categoriaId: 'entrantes', nombre: 'Pulpo a la gallega',  precio: 16.00, descripcion: 'Pulpo cocido con pimentón y aceite de oliva',        disponible: true, destino: 'cocina' },
  { categoriaId: 'entrantes', nombre: 'Gambas al ajillo',    precio: 12.00, descripcion: 'Gambas salteadas con ajo y guindilla',               disponible: true, destino: 'cocina' },
  // Carnes → cocina
  { categoriaId: 'carnes', nombre: 'Chuletón de vaca',    precio: 28.00, descripcion: 'Chuletón de vaca madurado, 400gr a la brasa',         disponible: true, destino: 'cocina' },
  { categoriaId: 'carnes', nombre: 'Solomillo ibérico',   precio: 24.00, descripcion: 'Solomillo ibérico a la plancha con patatas asadas',   disponible: true, destino: 'cocina' },
  { categoriaId: 'carnes', nombre: 'Entrecot angus',      precio: 22.00, descripcion: 'Entrecot de ternera Angus al punto',                  disponible: true, destino: 'cocina' },
  { categoriaId: 'carnes', nombre: 'Pollo a la brasa',    precio: 14.00, descripcion: 'Medio pollo asado al carbón con alioli',              disponible: true, destino: 'cocina' },
  { categoriaId: 'carnes', nombre: 'Secreto ibérico',     precio: 18.00, descripcion: 'Secreto de cerdo ibérico con pimientos asados',       disponible: true, destino: 'cocina' },
  // Pescados → cocina
  { categoriaId: 'pescados', nombre: 'Merluza a la romana',  precio: 18.00, descripcion: 'Merluza rebozada con patatas panadera',              disponible: true, destino: 'cocina' },
  { categoriaId: 'pescados', nombre: 'Dorada al horno',      precio: 20.00, descripcion: 'Dorada entera al horno con verduras y limón',        disponible: true, destino: 'cocina' },
  { categoriaId: 'pescados', nombre: 'Salmón a la plancha',  precio: 19.00, descripcion: 'Salmón noruego con salsa de eneldo y espárragos',    disponible: true, destino: 'cocina' },
  { categoriaId: 'pescados', nombre: 'Bacalao confitado',    precio: 21.00, descripcion: 'Lomo de bacalao confitado con pil pil tradicional',  disponible: true, destino: 'cocina' },
  // Postres → cocina
  { categoriaId: 'postres', nombre: 'Tarta de queso',          precio: 6.00, descripcion: 'Tarta de queso vasca caramelizada',           disponible: true, destino: 'cocina' },
  { categoriaId: 'postres', nombre: 'Brownie con helado',      precio: 5.50, descripcion: 'Brownie de chocolate con helado de vainilla',  disponible: true, destino: 'cocina' },
  { categoriaId: 'postres', nombre: 'Coulant de chocolate',    precio: 6.50, descripcion: 'Coulant templado con corazón fundido',         disponible: true, destino: 'cocina' },
  { categoriaId: 'postres', nombre: 'Flan de huevo casero',    precio: 4.00, descripcion: 'Flan artesano con caramelo tostado',           disponible: true, destino: 'cocina' },
  { categoriaId: 'postres', nombre: 'Tiramisú',                precio: 5.50, descripcion: 'Tiramisú clásico con café y mascarpone',       disponible: true, destino: 'cocina' },
  // Bebidas → barra
  { categoriaId: 'bebidas', nombre: 'Coca-Cola',              precio: 2.50,  descripcion: 'Coca-Cola, lata 33cl',             disponible: true, destino: 'barra' },
  { categoriaId: 'bebidas', nombre: 'Agua sin gas',           precio: 1.80,  descripcion: 'Agua mineral sin gas, 50cl',       disponible: true, destino: 'barra' },
  { categoriaId: 'bebidas', nombre: 'Agua con gas',           precio: 2.00,  descripcion: 'Agua mineral con gas, 50cl',       disponible: true, destino: 'barra' },
  { categoriaId: 'bebidas', nombre: 'Cerveza caña',           precio: 2.20,  descripcion: 'Caña de cerveza rubia, 25cl',      disponible: true, destino: 'barra' },
  { categoriaId: 'bebidas', nombre: 'Cerveza botellín',       precio: 2.80,  descripcion: 'Botellín de cerveza, 33cl',        disponible: true, destino: 'barra' },
  { categoriaId: 'bebidas', nombre: 'Vino blanco copa',       precio: 3.20,  descripcion: 'Copa de vino blanco de la casa',   disponible: true, destino: 'barra' },
  { categoriaId: 'bebidas', nombre: 'Vino tinto copa',        precio: 3.20,  descripcion: 'Copa de vino tinto de la casa',    disponible: true, destino: 'barra' },
  { categoriaId: 'bebidas', nombre: 'Rioja botella',          precio: 18.00, descripcion: 'Botella de Rioja Reserva',         disponible: true, destino: 'barra' },
  { categoriaId: 'bebidas', nombre: 'Sangría jarra',          precio: 9.00,  descripcion: 'Jarra de sangría casera, 1L',      disponible: true, destino: 'barra' },
  // Cafés → barra
  { categoriaId: 'cafes', nombre: 'Café solo',       precio: 1.50, descripcion: 'Espresso doble',                    disponible: true, destino: 'barra' },
  { categoriaId: 'cafes', nombre: 'Café con leche',  precio: 1.80, descripcion: 'Espresso con leche vaporizada',     disponible: true, destino: 'barra' },
  { categoriaId: 'cafes', nombre: 'Cortado',         precio: 1.60, descripcion: 'Espresso cortado con leche',        disponible: true, destino: 'barra' },
  { categoriaId: 'cafes', nombre: 'Cappuccino',      precio: 2.20, descripcion: 'Cappuccino con espuma de leche',    disponible: true, destino: 'barra' },
  { categoriaId: 'cafes', nombre: 'Té / Infusión',   precio: 2.00, descripcion: 'Variedad a elegir',                 disponible: true, destino: 'barra' },
];

export async function isSeeded(): Promise<boolean> {
  const snap = await getDocs(collection(db, 'mesas'));
  return !snap.empty;
}

export async function seedInitialData(): Promise<void> {
  const alreadySeeded = await isSeeded();
  if (alreadySeeded) return;

  const batch = writeBatch(db);

  // Mesas
  MESAS.forEach((mesa) => {
    const ref = doc(collection(db, 'mesas'));
    batch.set(ref, { ...mesa, estado: 'libre', pedidoActivo: null });
  });

  // Categorías
  CATEGORIAS.forEach(({ id, nombre, orden }) => {
    batch.set(doc(db, 'carta', id), { nombre, orden });
  });

  // Productos (Firestore batch limit is 500 writes)
  PRODUCTOS.forEach((prod) => {
    const ref = doc(collection(db, 'productos'));
    batch.set(ref, prod);
  });

  await batch.commit();
}
