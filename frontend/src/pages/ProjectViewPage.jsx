// src/pages/ProjectViewPage.jsx
import { useEffect, useState }   from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProject, useAuth, useToast }  from '../context/contexts';
import { api }         from '../services/api';

const SEV_COLOR = { LOW:'var(--success)', MEDIUM:'var(--warning)', HIGH:'var(--danger)', CRITICAL:'var(--sev-critical)' };

// Componente Modal para Regras
function RuleModal({ title, initial = '', onClose, onSave }) {
  const [value, setValue] = useState(initial);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setLoading(true);
    await onSave(value.trim());
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade-up" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Descrição da regra *</label>
            <textarea className="textarea" rows={3} value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Ex: O usuário deve estar autenticado para acessar o sistema" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading || !value.trim()}>
              {loading ? <span className="spinner" /> : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectViewPage() {
  const { projectId } = useParams();
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const { loadProject } = useProject();
  const { user }      = useAuth();
  const { toast }     = useToast();

  // Estados para Regras
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [editingRule, setEditingRule]       = useState(null);

  const canManage = user?.role === 'ADMIN' || user?.role === 'QA';

  const { data, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn:  () => api.get(`/projects/${projectId}`).then(r => r.data.data.project),
  });

  const { data: statsData } = useQuery({
    queryKey: ['project-stats', projectId],
    queryFn:  () => api.get(`/projects/${projectId}/stats`).then(r => r.data.data),
  });

  useEffect(() => { if (projectId) loadProject(projectId); }, [projectId]);

  // Handlers para Regras
  const handleDeleteRule = async (ruleId) => {
    if (!confirm('Deletar esta regra de negócio?')) return;
    try {
      await api.delete(`/projects/${projectId}/rules/${ruleId}`);
      toast('Regra deletada', 'success');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    } catch (err) {
      if (err.response?.status === 409) {
        if (confirm(`${err.response.data.message}\n\nDeseja forçar a exclusão?`)) {
          await api.delete(`/projects/${projectId}/rules/${ruleId}?force=true`);
          toast('Regra deletada permanentemente', 'success');
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
        }
      } else {
        toast(err.response?.data?.message || 'Erro ao deletar', 'error');
      }
    }
  };

  const handleCreateRule = async (description) => {
    try {
      await api.post(`/projects/${projectId}/rules`, { description });
      toast('Regra criada!', 'success');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowCreateRule(false);
    } catch (err) {
      toast(err.response?.data?.message || 'Erro ao criar regra', 'error');
    }
  };

  const handleUpdateRule = async (ruleId, description) => {
    try {
      await api.put(`/projects/${projectId}/rules/${ruleId}`, { description });
      toast('Regra atualizada!', 'success');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setEditingRule(null);
    } catch (err) {
      toast(err.response?.data?.message || 'Erro ao atualizar', 'error');
    }
  };

  if (isLoading) return <div style={{ display:'flex', justifyContent:'center', paddingTop:80 }}><span className="spinner" style={{ width:28, height:28 }} /></div>;
  if (!data) return <div className="card"><p style={{ textAlign:'center', color:'var(--text-muted)', padding:40 }}>Projeto não encontrado.</p></div>;

  const project = data;
  const stats   = statsData;

  return (
    <div className="animate-fade-in">
      {/* Header do Projeto */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, fontSize:'0.8rem', color:'var(--text-muted)' }}>
          <button onClick={() => navigate('/projects')} style={{ background: 'none', border: 'none', cursor: 'pointer', color:'var(--text-muted)', padding: 0 }}>← Projetos</button>
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

      {/* Stats Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, marginBottom:28 }}>
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

      <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap:20 }}>

        {/* Seção de Regras de Negócio */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Regras de negócio</h2>
            {canManage && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreateRule(true)}>
                + Nova regra
              </button>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {project.businessRules?.length === 0 ? (
              <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', textAlign:'center', padding:'20px 0' }}>Nenhuma regra cadastrada.</p>
            ) : project.businessRules?.map(rule => {
              const canEditRule = user?.role === 'ADMIN' || rule.createdById === user?.id;

              return (
                <div key={rule.id} style={{ padding:'12px', background:'var(--bg-raised)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--accent)', background:'var(--accent-dim)', padding:'2px 6px', borderRadius:4, flexShrink:0 }}>{rule.ruleCode}</span>
                      <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)', lineHeight:1.5 }}>{rule.description}</p>
                    </div>
                    {canEditRule && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', height: 'auto' }} onClick={() => setEditingRule(rule)}>Editar</button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', height: 'auto', color: 'var(--danger)' }} onClick={() => handleDeleteRule(rule.id)}>Deletar</button>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{rule._count?.testCases||0} testes vinculados</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bugs recentes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize:'0.9rem', fontWeight: 600 }}>Bugs recentes</h2>
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

      {/* Modais de Regras */}
      {showCreateRule && (
        <RuleModal
          title="Nova regra de negócio"
          onClose={() => setShowCreateRule(false)}
          onSave={handleCreateRule}
        />
      )}

      {editingRule && (
        <RuleModal
          title="Editar regra"
          initial={editingRule.description}
          onClose={() => setEditingRule(null)}
          onSave={(desc) => handleUpdateRule(editingRule.id, desc)}
        />
      )}
    </div>
  );
}