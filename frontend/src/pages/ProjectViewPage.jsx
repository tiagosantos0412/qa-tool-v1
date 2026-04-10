// src/pages/ProjectViewPage.jsx
import { useEffect }   from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery }    from '@tanstack/react-query';
import { useProject }  from '../context/contexts';
import { api }         from '../services/api';

const SEV_COLOR = { LOW:'var(--success)', MEDIUM:'var(--warning)', HIGH:'var(--danger)', CRITICAL:'var(--sev-critical)' };

export default function ProjectViewPage() {
  const { projectId } = useParams();
  const navigate      = useNavigate();
  const { loadProject } = useProject();

  const { data, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn:  () => api.get(`/projects/${projectId}`).then(r => r.data.data.project),
  });

  const { data: statsData } = useQuery({
    queryKey: ['project-stats', projectId],
    queryFn:  () => api.get(`/projects/${projectId}/stats`).then(r => r.data.data),
  });

  useEffect(() => { if (projectId) loadProject(projectId); }, [projectId]);

  if (isLoading) return <div style={{ display:'flex', justifyContent:'center', paddingTop:80 }}><span className="spinner" style={{ width:28, height:28 }} /></div>;
  if (!data) return <div className="card"><p style={{ textAlign:'center', color:'var(--text-muted)', padding:40 }}>Projeto não encontrado.</p></div>;

  const project = data;
  const stats   = statsData;

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, fontSize:'0.8rem', color:'var(--text-muted)' }}>
          <button onClick={() => navigate('/projects')} style={{ color:'var(--text-muted)' }}>← Projetos</button>
          <span>/</span>
          <span style={{ color:'var(--text-secondary)' }}>{project.name}</span>
        </div>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
          <div>
            <h1 style={{ marginBottom:6 }}>{project.name}</h1>
            <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem', maxWidth:640 }}>{project.objective}</p>
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/projects/${projectId}/bugs`)}>🐛 Bugs</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/projects/${projectId}/test-cases`)}>🧪 Testes</button>
          </div>
        </div>
        {project.actors?.length > 0 && (
          <div style={{ display:'flex', gap:6, marginTop:12, flexWrap:'wrap' }}>
            <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', alignSelf:'center' }}>Atores:</span>
            {project.actors.map(a => (
              <span key={a} style={{ fontSize:'0.75rem', padding:'3px 10px', background:'var(--bg-overlay)', border:'1px solid var(--border-subtle)', borderRadius:4, color:'var(--text-secondary)' }}>{a}</span>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:28 }}>
        {[
          { label:'Regras RN',      value: stats?.overview?.totalRules, color: 'var(--text-primary)' },
          { label:'Casos de Teste', value: stats?.overview?.totalTests, color: 'var(--info)' },
          { label:'Total Bugs',     value: stats?.overview?.totalBugs,  color: 'var(--warning)' },
          { label:'Bugs em aberto', value: stats?.overview?.openBugs,   color: 'var(--danger)' },
          { label:'Críticos',       value: stats?.overview?.criticalBugs, color: 'var(--sev-critical)' },
        ].map(s => (
          <div key={s.label} style={{ padding:'16px 24px', background:'var(--bg-raised)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-subtle)', textAlign:'center' }}>
            <p style={{ fontSize:'1.6rem', fontWeight:700, fontFamily:'var(--font-mono)', color: s.color, letterSpacing:'-0.03em' }}>{s.value ?? '—'}</p>
            <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Regras */}
        <div className="card">
          <h2 style={{ fontSize:'0.9rem', marginBottom:16 }}>Regras de negócio</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {project.businessRules?.length === 0 ? (
              <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', textAlign:'center', padding:'20px 0' }}>Nenhuma regra cadastrada.</p>
            ) : project.businessRules?.map(rule => (
              <div key={rule.id} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 12px', background:'var(--bg-raised)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-subtle)' }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--accent)', background:'var(--accent-dim)', padding:'2px 6px', borderRadius:4, flexShrink:0, marginTop:1 }}>{rule.ruleCode}</span>
                <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)', lineHeight:1.5 }}>{rule.description}</p>
                <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', flexShrink:0, marginLeft:'auto' }}>{rule._count?.testCases||0} testes</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bugs recentes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize:'0.9rem' }}>Bugs recentes</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/projects/${projectId}/bugs`)}>Ver todos →</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {project.bugs?.length === 0 ? (
              <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', textAlign:'center', padding:'20px 0' }}>Nenhum bug. 🎉</p>
            ) : project.bugs?.map(bug => (
              <div key={bug.id}
                onClick={() => navigate(`/projects/${projectId}/bugs/${bug.id}`)}
                style={{ padding:'10px 12px', background:'var(--bg-raised)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-subtle)', cursor:'pointer', transition:'border-color var(--t-fast)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = ''}
              >
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-muted)' }}>{bug.bugCode}</span>
                  <span style={{ fontSize:'0.72rem', fontWeight:600, color: SEV_COLOR[bug.severity] }}>● {bug.severity}</span>
                </div>
                <p style={{ fontSize:'0.83rem', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{bug.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
