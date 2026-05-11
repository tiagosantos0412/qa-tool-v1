// src/pages/ProjectViewPage.jsx
import { useEffect, useState }   from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProject, useAuth, useToast }  from '../context/contexts';
import { api }         from '../services/api';

const SEV_COLOR = { LOW:'var(--success)', MEDIUM:'var(--warning)', HIGH:'var(--danger)', CRITICAL:'var(--sev-critical)' };

// Função auxiliar para agrupar itens por módulo
function groupByModule(items) {
  if (!items) return {};
  return items.reduce((acc, item) => {
    const key = item.module || 'Geral';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

// Componente Modal para Regras
function RuleModal({ title, initial = '', initialModule = '', onClose, onSave }) {
  const [value,  setValue]  = useState(initial);
  const [module, setModule] = useState(initialModule);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setLoading(true);
    await onSave(value.trim(), module.trim() || null);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade-up" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Módulo / Categoria</label>
            <input className="input" value={module} onChange={e => setModule(e.target.value)}
              placeholder="Ex: Autenticação, Pagamentos, Cadastro" />
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Descrição da regra *</label>
            <textarea className="textarea" rows={3} value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Ex: O usuário deve estar autenticado para acessar o sistema" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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

  const [showCreateRule, setShowCreateRule] = useState(false);
  const [editingRule, setEditingRule]       = useState(null);

  // Estado para os Accordions
  const [expandedModules, setExpandedModules] = useState({});

  const canManage = user?.role === 'ADMIN' || user?.role === 'QA';

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn:  () => api.get(`/projects/${projectId}`).then(r => r.data.data.project),
  });

  const { data: stats } = useQuery({
    queryKey: ['project-stats', projectId],
    queryFn:  () => api.get(`/projects/${projectId}/stats`).then(r => r.data.data),
  });

  useEffect(() => { if (projectId) loadProject(projectId); }, [projectId]);

  const toggleModule = (moduleName) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleName]: !prev[moduleName]
    }));
  };

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
          queryClient.invalidateQueries({ queryKey: ['project', projectId] });
        }
      } else {
        toast(err.response?.data?.message || 'Erro ao deletar', 'error');
      }
    }
  };

  const handleCreateRule = async (description, module) => {
    try {
      await api.post(`/projects/${projectId}/rules`, { description, module });
      toast('Regra criada!', 'success');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowCreateRule(false);
    } catch (err) {
      toast(err.response?.data?.message || 'Erro ao criar regra', 'error');
    }
  };

  const handleUpdateRule = async (ruleId, description, module) => {
    try {
      await api.put(`/projects/${projectId}/rules/${ruleId}`, { description, module });
      toast('Regra atualizada!', 'success');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setEditingRule(null);
    } catch (err) {
      toast(err.response?.data?.message || 'Erro ao atualizar', 'error');
    }
  };

  if (isLoading) return <div style={{ display:'flex', justifyContent:'center', paddingTop:80 }}><span className="spinner" style={{ width:28, height:28 }} /></div>;
  if (!project) return <div className="card"><p style={{ textAlign:'center', color:'var(--text-muted)', padding:40 }}>Projeto não encontrado.</p></div>;

  return (
    <div className="animate-fade-in">
      {/* HEADER */}
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
      </div>

      {/* STATS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, marginBottom:28 }}>
        {[
          { label:'Regras RN',      value: stats?.overview?.totalRules, color: 'var(--text-primary)' },
          { label:'Casos de Teste', value: stats?.overview?.totalTests, color: 'var(--info)' },
          { label:'Total Bugs',     value: stats?.overview?.totalBugs,  color: 'var(--warning)' },
          { label:'Bugs em aberto', value: stats?.overview?.openBugs,   color: 'var(--danger)' },
          { label:'Críticos',       value: stats?.overview?.criticalBugs, color: 'var(--sev-critical)' },
        ].map(s => (
          <div key={s.label} className="card-raised" style={{ textAlign:'center', padding: '16px' }}>
            <p style={{ fontSize:'1.6rem', fontWeight:700, fontFamily:'var(--font-mono)', color: s.color }}>{s.value ?? '—'}</p>
            <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap:20 }}>

        {/* REGRAS COM ACCORDION */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Regras de negócio</h2>
            {canManage && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreateRule(true)}>
                + Nova regra
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(!project.businessRules || project.businessRules.length === 0) ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '20px 0' }}>
                Nenhuma regra cadastrada.
              </p>
            ) : (
              Object.entries(groupByModule(project.businessRules)).map(([module, rules]) => {
                const isExpanded = expandedModules[module];
                return (
                  <div key={module} style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    background: isExpanded ? 'var(--bg-raised)' : 'transparent'
                  }}>
                    {/* Header Clicável */}
                    <div
                      onClick={() => toggleModule(module)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', cursor: 'pointer', userSelect: 'none'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px',
                          background: 'var(--accent-dim)', color: 'var(--accent)',
                          borderRadius: 4, fontFamily: 'var(--font-mono)',
                        }}>
                          {module}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {rules.length} regra{rules.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '0.7rem', color: 'var(--text-muted)',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                      }}>▼</span>
                    </div>

                    {/* Conteúdo Expandível com Animação */}
                    {isExpanded && (
                      <div style={{
                        padding: '0 12px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        animation: 'slideDown 0.2s ease-out'
                      }}>
                        {rules.map(rule => {
                          const canEdit = user?.role === 'ADMIN' || rule.createdById === user?.id;
                          return (
                            <div key={rule.id} style={{
                              padding: '12px', background: 'var(--bg-surface)',
                              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '0.75rem' }}>
                                    {rule.ruleCode}
                                  </span>
                                  <p style={{ fontSize: '0.83rem', marginTop: 4, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                    {rule.description}
                                  </p>
                                </div>
                                {canEdit && (
                                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }}
                                      onClick={(e) => { e.stopPropagation(); setEditingRule(rule); }}>
                                      Editar
                                    </button>
                                    <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', color: 'var(--danger)' }}
                                      onClick={(e) => { e.stopPropagation(); handleDeleteRule(rule.id); }}>
                                      Deletar
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* BUGS RECENTES */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize:'0.9rem', fontWeight: 600 }}>Bugs recentes</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/projects/${projectId}/bugs`)}>Ver todos →</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {!project.bugs?.length ? (
              <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', textAlign:'center', padding:'20px 0' }}>Nenhum bug. 🎉</p>
            ) : project.bugs?.map(bug => (
              <div key={bug.id}
                onClick={() => navigate(`/projects/${projectId}/bugs/${bug.id}`)}
                className="card-raised" style={{ padding:'10px 12px', cursor:'pointer' }}
              >
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-muted)' }}>{bug.bugCode}</span>
                  <span style={{ fontSize:'0.72rem', fontWeight:600, color: SEV_COLOR[bug.severity] }}>● {bug.severity}</span>
                </div>
                <p style={{ fontSize:'0.83rem', fontWeight:500 }}>{bug.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAIS */}
      {showCreateRule && (
        <RuleModal
          title="Nova regra de negócio"
          onClose={() => setShowCreateRule(false)}
          onSave={(desc, mod) => handleCreateRule(desc, mod)}
        />
      )}

      {editingRule && (
        <RuleModal
          title="Editar regra"
          initial={editingRule.description}
          initialModule={editingRule.module || ''}
          onClose={() => setEditingRule(null)}
          onSave={(desc, mod) => handleUpdateRule(editingRule.id, desc, mod)}
        />
      )}
    </div>
  );
}