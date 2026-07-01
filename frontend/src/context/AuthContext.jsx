import React, { createContext, useContext, useEffect, useState } from 'react';
import { getMe } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    const token = localStorage.getItem('careeros_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      localStorage.removeItem('careeros_token');
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUser();
  }, []);

  const loginSession = (token, userData) => {
    localStorage.setItem('careeros_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('careeros_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginSession, logout, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
