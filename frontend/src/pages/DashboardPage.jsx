// src/pages/DashboardPage.jsx
import { useQuery }    from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/contexts';
import { api }         from '../services/api';

const SEV_COLOR = { LOW:'var(--success)', MEDIUM:'var(--warning)', HIGH:'var(--danger)', CRITICAL:'var(--sev-critical)' };
const STA_COLOR = { OPEN:'var(--danger)', IN_PROGRESS:'var(--warning)', RESOLVED:'var(--info)', CLOSED:'var(--success)', REJECTED:'var(--text-muted)' };
const STA_LABEL = { OPEN:'Aberto', IN_PROGRESS:'Em andamento', RESOLVED:'Resolvido', CLOSED:'Fechado', REJECTED:'Rejeitado' };

function timeAgo(d) {
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m/60)}h`;
  return `${Math.floor(m/1440)}d`;
}

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="card animate-fade-up" style={{ position:'relative', overflow:'hidden' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{label}</p>
          <p style={{ fontSize:'2rem', fontWeight:600, fontFamily:'var(--font-mono)', color: accent || 'var(--text-primary)', letterSpacing:'-0.03em', lineHeight:1 }}>{value ?? '—'}</p>
          {sub && <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:6 }}>{sub}</p>}
        </div>
        {icon && <span style={{ fontSize:'1.5rem', opacity:0.25 }}>{icon}</span>}
      </div>
      {accent && <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${accent}, transparent)` }} />}
    </div>
  );
}

export default function DashboardPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const profile = user?.qaProfile || user?.developerProfile;
  const firstName = profile?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'usuário';
  const hour      = new Date().getHours();
  const greet     = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => api.get('/projects').then(r => r.data.data),
  });

  const projects = projectsData?.projects || [];
  const totalTests = projects.reduce((acc, p) => acc + (p._count?.testCases || 0), 0);
  const totalBugs  = projects.reduce((acc, p) => acc + (p._count?.bugs || 0), 0);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 style={{ fontWeight:600, letterSpacing:'-0.025em', marginBottom:4 }}>
          {greet}, {firstName}  👋
        </h1>
        <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>
          Aqui está o estado atual da qualidade nos seus projetos.
        </p>
      </div>

      <div className="stagger" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        <StatCard label="Projetos"      value={projects.length} icon="📁" sub={`${projects.length} ativos`} />
        <StatCard label="Total de Bugs" value={totalBugs}       icon="🐛" accent="var(--danger)"  sub="em todos os projetos" />
        <StatCard label="Casos de Teste" value={totalTests}     icon="🧪" accent="var(--info)"   sub="em todos os projetos" />
        <StatCard label="Times"         value={new Set(projects.map(p => p.createdById)).size} icon="👥" />
      </div>

      <div style={{ marginBottom:24 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize:'0.9rem' }}>Projetos recentes</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>Ver todos →</button>
        </div>

        {isLoading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:40 }}><span className="spinner" style={{ width:28, height:28 }} /></div>
        ) : projects.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <span className="empty-state__icon">📁</span>
              <p className="empty-state__title">Nenhum projeto ainda</p>
              <p className="empty-state__desc">Crie seu primeiro projeto para começar.</p>
              <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => navigate('/projects')}>Criar projeto</button>
            </div>
          </div>
        ) : (
          <div className="stagger" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
            {projects.map(p => (
              <div key={p.id} className="card" style={{ cursor:'pointer', transition:'border-color var(--t-fast), background var(--t-fast)' }}
                onClick={() => navigate(`/projects/${p.id}`)}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.background='var(--bg-raised)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=''; e.currentTarget.style.background=''; }}
              >
                <h3 style={{ fontSize:'0.9rem', fontWeight:600, marginBottom:6 }}>{p.name}</h3>
                <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:14, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {p.objective}
                </p>
                <div style={{ display:'flex', gap:20, borderTop:'1px solid var(--border-subtle)', paddingTop:12 }}>
                  {[{ l:'Regras', v: p._count?.businessRules||0 }, { l:'Testes', v: p._count?.testCases||0 }, { l:'Bugs', v: p._count?.bugs||0, danger:true }].map(m => (
                    <div key={m.l}>
                      <p style={{ fontSize:'1rem', fontWeight:600, fontFamily:'var(--font-mono)', color: m.danger && m.v > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{m.v}</p>
                      <p style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{m.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
