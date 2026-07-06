// Detecta si un error de Firestore es por falta de índice compuesto
export function isIndexError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('requires an index') ||
    msg.includes('failed_precondition') ||
    msg.includes('the query requires') ||
    msg.includes('index') && msg.includes('console.firebase.google.com')
  );
}

// Devuelve un mensaje amigable según el tipo de error de Firestore
export function friendlyFirestoreError(err: unknown): string {
  if (!(err instanceof Error)) return 'Error desconocido';
  if (isIndexError(err))
    return 'Función en configuración. Vuelve a intentarlo en unos minutos.';
  if (err.message.includes('permission-denied') || err.message.includes('PERMISSION_DENIED'))
    return 'Sin permiso para acceder a estos datos.';
  if (err.message.includes('unavailable') || err.message.includes('UNAVAILABLE'))
    return 'Sin conexión con la base de datos.';
  return err.message;
}
