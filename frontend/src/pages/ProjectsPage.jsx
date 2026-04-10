// src/pages/ProjectsPage.jsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api }      from '../services/api';
import { useToast } from '../context/contexts';
import { useAuth }  from '../context/contexts';

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name:'', objective:'', actors:'', description:'' });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/projects', {
        ...form,
        actors: form.actors.split(',').map(a => a.trim()).filter(Boolean),
      });
      onCreated(data.data.project);
      toast('Projeto criado!', 'success');
      onClose();
    } catch (err) {
      toast(err.response?.data?.message || 'Erro ao criar projeto', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade-up">
        <div className="modal-header">
          <h2 style={{ fontSize:'1rem', fontWeight:600 }}>Novo projeto</h2>
          <button onClick={onClose} style={{ color:'var(--text-muted)', fontSize:'1.2rem' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Ex: Plataforma E-commerce v3" required />
          </div>
          <div className="form-group">
            <label className="form-label">Objetivo *</label>
            <textarea className="textarea" value={form.objective} onChange={set('objective')} placeholder="Descreva o objetivo principal" required rows={3} />
          </div>
          <div className="form-group">
            <label className="form-label">Atores <span style={{ color:'var(--text-muted)' }}>(separados por vírgula)</span></label>
            <input className="input" value={form.actors} onChange={set('actors')} placeholder="Ex: Cliente, Administrador" />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição opcional</label>
            <textarea className="textarea" value={form.description} onChange={set('description')} rows={2} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Criar projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]       = useState('');
  const queryClient = useQueryClient();
  const navigate    = useNavigate();
  const { isQA }    = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['projects', search],
    queryFn:  () => api.get(`/projects?search=${search}`).then(r => r.data.data),
  });

  const projects = data?.projects || [];

  const handleCreated = (project) => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    navigate(`/projects/${project.id}`);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ marginBottom:4 }}>Projetos</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>{projects.length} projeto{projects.length !== 1 ? 's' : ''}</p>
        </div>
        {isQA && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Novo projeto</button>}
      </div>

      <div style={{ marginBottom:20 }}>
        <input className="input" style={{ maxWidth:360 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou objetivo..." />
      </div>

      {isLoading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><span className="spinner" style={{ width:28, height:28 }} /></div>
      ) : projects.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span className="empty-state__icon">📁</span>
            <p className="empty-state__title">{search ? 'Nenhum resultado' : 'Nenhum projeto ainda'}</p>
            <p className="empty-state__desc">{search ? 'Tente outro termo.' : 'Clique em "Novo projeto" para começar.'}</p>
          </div>
        </div>
      ) : (
        <div className="stagger" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:14 }}>
          {projects.map(p => (
            <div key={p.id} className="card" style={{ cursor:'pointer', transition:'border-color var(--t-fast), background var(--t-fast)' }}
              onClick={() => navigate(`/projects/${p.id}`)}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.background='var(--bg-raised)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=''; e.currentTarget.style.background=''; }}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <h3 style={{ fontSize:'0.9rem', fontWeight:600 }}>{p.name}</h3>
                {p.isArchived && <span className="badge badge-neutral">Arquivado</span>}
              </div>
              <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:14, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                {p.objective}
              </p>
              {p.actors?.length > 0 && (
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:14 }}>
                  {p.actors.slice(0,3).map(a => (
                    <span key={a} style={{ fontSize:'0.7rem', padding:'2px 8px', background:'var(--bg-overlay)', border:'1px solid var(--border-subtle)', borderRadius:4, color:'var(--text-muted)' }}>{a}</span>
                  ))}
                </div>
              )}
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

      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </div>
  );
}
