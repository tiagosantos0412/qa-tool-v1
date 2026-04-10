// src/context/contexts.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

// ── TOAST ─────────────────────────────────────────
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const icons = { success: '✓', error: '✕', info: '◉' };
  const colors = { success: 'var(--success)', error: 'var(--danger)', info: 'var(--info)' };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span style={{ color: colors[t.type], fontWeight: 600 }}>{icons[t.type]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ── AUTH ──────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }

    api.get('/auth/me')
      .then(({ data }) => setUser(data.data.user))
      .catch(() => localStorage.removeItem('accessToken'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { }
    localStorage.removeItem('accessToken');
    setUser(null);
  }, []);

  const isQA  = user?.role === 'QA'  || user?.role === 'ADMIN';
  const isDev = user?.role === 'DEVELOPER';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isQA, isDev }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};

// ── PROJECT ───────────────────────────────────────
const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [currentProject, setCurrentProject] = useState(null);
  const [businessRules,  setBusinessRules]  = useState([]);
  const [loadingProject, setLoadingProject] = useState(false);

  const loadProject = useCallback(async (projectId) => {
    if (currentProject?.id === projectId) return currentProject;
    setLoadingProject(true);
    try {
      const { data } = await api.get(`/projects/${projectId}`);
      const project  = data.data.project;
      setCurrentProject(project);
      setBusinessRules(project.businessRules || []);
      return project;
    } finally {
      setLoadingProject(false);
    }
  }, [currentProject]);

  const clearProject = useCallback(() => {
    setCurrentProject(null);
    setBusinessRules([]);
  }, []);

  return (
    <ProjectContext.Provider value={{
      currentProject, businessRules, loadingProject,
      loadProject, clearProject, setCurrentProject,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => useContext(ProjectContext);
