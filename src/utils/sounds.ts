let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

function beep(freq: number, duration: number, volume = 0.25, delay = 0) {
  try {
    const c    = getCtx();
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    const t = c.currentTime + delay;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  } catch { /* AudioContext no disponible */ }
}

/** Bebida nueva llegada a barra: doble tono agudo */
export function playBebidaNueva() {
  beep(880, 0.1, 0.3, 0);
  beep(1100, 0.12, 0.3, 0.16);
}

/** Cuenta pedida: tres tonos descendentes */
export function playCuentaPedida() {
  beep(784, 0.1, 0.4, 0);
  beep(659, 0.1, 0.4, 0.18);
  beep(523, 0.15, 0.4, 0.36);
}

/** Comanda nueva en cocina: tono grave corto */
export function playComandaNueva() {
  beep(440, 0.2, 0.5, 0);
}

/** Todo listo en cocina: tres tonos ascendentes */
export function playCocinaLista() {
  beep(523, 0.08, 0.3, 0);
  beep(659, 0.08, 0.3, 0.12);
  beep(784, 0.12, 0.3, 0.24);
}
