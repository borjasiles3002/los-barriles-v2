export function LoadingSpinner({ size = 8, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 border-white/20 border-t-white w-${size} h-${size} ${className}`}
    />
  );
}

export function FullScreenLoader({ message = 'Cargando...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 text-white">
      <LoadingSpinner size={10} />
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}
