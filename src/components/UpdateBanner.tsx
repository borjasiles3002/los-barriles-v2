import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateBanner() {
  const { needRefresh: [needRefresh] } = useRegisterSW();

  if (!needRefresh) return null;

  const handleUpdate = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.waiting) {
        // Escuchar controllerchange ANTES de enviar SKIP_WAITING
        // para evitar race condition (reload antes de que el nuevo SW tome control)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-amber-400 text-slate-900 px-4 py-3 rounded-xl shadow-xl font-medium text-sm whitespace-nowrap">
      <span>🔄 Nueva versión disponible</span>
      <button
        onClick={() => void handleUpdate()}
        className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors"
      >
        Actualizar
      </button>
    </div>
  );
}
