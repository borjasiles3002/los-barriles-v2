import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { AppUser, Role } from '../types';

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
        if (snap.exists()) {
          setUser({ uid: firebaseUser.uid, ...snap.data() } as AppUser);
        } else {
          // First login: determine role from admin email env var or default to camarero
          const adminEmail = import.meta.env.VITE_ADMIN_EMAIL ?? '';
          const role: Role = firebaseUser.email === adminEmail ? 'admin' : 'camarero';
          const newUser: AppUser = {
            uid:    firebaseUser.uid,
            email:  firebaseUser.email ?? '',
            role,
            nombre: firebaseUser.displayName ?? firebaseUser.email ?? 'Usuario',
          };
          await setDoc(doc(db, 'usuarios', firebaseUser.uid), newUser);
          setUser(newUser);
        }
      } catch {
        setUser(null);
      }

      setLoading(false);
    });

    return unsub;
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => useContext(AuthContext);
