// src/components/Layout/AppLayout.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth }    from '../../context/contexts';
import { useProject } from '../../context/contexts';

export default function AppLayout() {
  return (
    <div className="app-shell">
      <Topbar />
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function Topbar() {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.95rem', fontWeight:500, color:'var(--accent)', letterSpacing:'-0.02em', flexShrink:0 }}>
        qa<span style={{ color:'var(--text-muted)' }}>/</span>platform
      </div>
      <div style={{ flex:1, maxWidth:320, marginLeft:16, position:'relative' }}>
        <input
          style={{ width:'100%', padding:'6px 12px', background:'var(--bg-raised)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontSize:'0.82rem', outline:'none' }}
          placeholder="Buscar projetos, bugs..."
        />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto' }}>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects')}>
          + Novo
        </button>
      </div>
    </header>
  );
}

function Sidebar() {
  const { user, logout }   = useAuth();
  const { currentProject } = useProject();
  const navigate           = useNavigate();

  const profile  = user?.qaProfile || user?.developerProfile;
  const initials = profile?.name?.split(' ').slice(0,2).map(n => n[0]).join('') || '??';
  const roleLabel = { QA:'QA Engineer', DEVELOPER:'Developer', ADMIN:'Admin' }[user?.role] || '';

  const linkStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '7px 16px',
    fontSize: '0.83rem',
    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
    background: isActive ? 'var(--accent-dim)' : 'transparent',
    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
    transition: 'all var(--t-fast)',
    cursor: 'pointer',
    textDecoration: 'none',
  });

  return (
    <aside className="sidebar">
      {/* Nav principal */}
      <div style={{ marginBottom:8 }}>
        <p style={{ padding:'0 16px 6px', fontSize:'0.68rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-muted)' }}>
          Principal
        </p>
        <NavLink to="/dashboard" style={linkStyle}>📊 Dashboard</NavLink>
        <NavLink to="/projects"  style={linkStyle}>📁 Projetos</NavLink>
      </div>

      {/* Nav do projeto ativo */}
      {currentProject && (
        <>
          <div style={{ height:1, background:'var(--border-subtle)', margin:'12px 16px' }} />
          <p style={{ padding:'0 16px 6px', fontSize:'0.68rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-muted)' }}>
            Projeto
          </p>
          <p style={{ padding:'0 16px 8px', fontSize:'0.78rem', color:'var(--text-secondary)', fontFamily:'var(--font-mono)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {currentProject.name}
          </p>
          <NavLink to={`/projects/${currentProject.id}`}             end style={linkStyle}>📋 Visão Geral</NavLink>
          <NavLink to={`/projects/${currentProject.id}/test-cases`}  style={linkStyle}>🧪 Casos de Teste</NavLink>
          <NavLink to={`/projects/${currentProject.id}/bugs`}        style={linkStyle}>🐛 Bugs</NavLink>
          <NavLink to={`/projects/${currentProject.id}/ai`}          style={linkStyle}>✦ Assistente IA</NavLink>
        </>
      )}

      {/* Footer */}
      <div style={{ flex:1 }} />
      <div style={{ padding:16, borderTop:'1px solid var(--border-subtle)' }}>
        <div
          onClick={() => navigate('/dashboard')}
          style={{ display:'flex', alignItems:'center', gap:10, padding:8, borderRadius:'var(--radius-md)', cursor:'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--accent-dim)', border:'1px solid var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.72rem', fontWeight:600, color:'var(--accent)', flexShrink:0 }}>
            {initials}
          </div>
          <div style={{ minWidth:0 }}>
            <p style={{ fontSize:'0.8rem', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {profile?.name || user?.email}
            </p>
            <p style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={logout}
          style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'7px 8px', marginTop:4, borderRadius:'var(--radius-md)', color:'var(--text-muted)', fontSize:'0.8rem', transition:'background var(--t-fast)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          ← Sair
        </button>
      </div>
    </aside>
  );
}
