import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { LoadingSpinner } from './ui/LoadingSpinner';

export const LoginView: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError('Email o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500 mb-4">
            <span className="text-3xl">🍺</span>
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-widest">Los Barriles</h1>
          <p className="text-slate-400 text-sm mt-1">Sistema de gestión</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-slate-800 rounded-2xl p-6 shadow-xl space-y-4 border border-slate-700">
          <div>
            <label className="block text-slate-400 text-xs font-bold mb-1 uppercase tracking-wide">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs font-bold mb-1 uppercase tracking-wide">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-black rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <LoadingSpinner size={5} /> : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
