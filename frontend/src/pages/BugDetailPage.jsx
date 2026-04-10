// src/pages/BugDetailPage.jsx
import { useState }   from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api }      from '../services/api';
import { useToast } from '../context/contexts';

const SEV_COLOR = { LOW:'var(--success)', MEDIUM:'var(--warning)', HIGH:'var(--danger)', CRITICAL:'var(--sev-critical)' };
const STA_COLOR = { OPEN:'var(--danger)', IN_PROGRESS:'var(--warning)', RESOLVED:'var(--info)', CLOSED:'var(--success)', REJECTED:'var(--text-muted)' };
const STA_LABEL = { OPEN:'Aberto', IN_PROGRESS:'Em andamento', RESOLVED:'Resolvido', CLOSED:'Fechado', REJECTED:'Rejeitado' };

export default function BugDetailPage() {
  const { projectId, bugId } = useParams();
  const navigate    = useNavigate();
  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bug', bugId],
    queryFn:  () => api.get(`/projects/${projectId}/bugs/${bugId}`).then(r => r.data.data.bug),
  });

  const bug = data;

  const updateStatus = async (status) => {
    try {
      await api.put(`/projects/${projectId}/bugs/${bugId}`, { status });
      queryClient.invalidateQueries({ queryKey: ['bug', bugId] });
      toast('Status atualizado!', 'success');
    } catch { toast('Erro ao atualizar', 'error'); }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await api.post(`/projects/${projectId}/bugs/${bugId}/comments`, { content: comment });
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['bug', bugId] });
    } catch { toast('Erro ao comentar', 'error'); }
  };

  if (isLoading) return <div style={{ display:'flex', justifyContent:'center', paddingTop:80 }}><span className="spinner" style={{ width:28, height:28 }} /></div>;
  if (!bug) return <p style={{ textAlign:'center', color:'var(--text-muted)', paddingTop:60 }}>Bug não encontrado.</p>;

  const profile = u => u?.qaProfile?.name || u?.developerProfile?.name || u?.email || '—';

  return (
    <div className="animate-fade-in">
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, fontSize:'0.8rem', color:'var(--text-muted)' }}>
        <button onClick={() => navigate(`/projects/${projectId}/bugs`)} style={{ color:'var(--text-muted)' }}>← Bugs</button>
        <span>/</span>
        <span style={{ fontFamily:'var(--font-mono)', color:'var(--accent)' }}>{bug.bugCode}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:24, alignItems:'start' }}>
        {/* Conteúdo principal */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <h1 style={{ fontSize:'1.15rem', lineHeight:1.3, flex:1, marginRight:16 }}>{bug.title}</h1>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <span style={{ fontSize:'0.78rem', fontWeight:700, color: SEV_COLOR[bug.severity] }}>● {bug.severity}</span>
                <span style={{ fontSize:'0.72rem', color:STA_COLOR[bug.status], background:`${STA_COLOR[bug.status]}18`, padding:'3px 10px', borderRadius:4, fontFamily:'var(--font-mono)' }}>{STA_LABEL[bug.status]}</span>
              </div>
            </div>
            <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.7 }}>{bug.description}</p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {[
              { label:'✓ Resultado esperado', value:bug.expectedResult, color:'var(--success)' },
              { label:'✕ Resultado atual',    value:bug.actualResult,   color:'var(--danger)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ borderLeft:`3px solid ${color}` }}>
                <p style={{ fontSize:'0.72rem', fontWeight:600, color, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>{label}</p>
                <p style={{ fontSize:'0.83rem', color:'var(--text-secondary)', lineHeight:1.6 }}>{value}</p>
              </div>
            ))}
          </div>

          {bug.stepsToRepro?.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize:'0.82rem', color:'var(--text-secondary)', marginBottom:14, textTransform:'uppercase', letterSpacing:'0.05em' }}>Passos para reproduzir</h3>
              <ol style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {bug.stepsToRepro.map((step, i) => (
                  <li key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--accent)', background:'var(--accent-dim)', width:22, height:22, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</span>
                    <span style={{ fontSize:'0.83rem', color:'var(--text-secondary)', lineHeight:1.6 }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {bug.attachments?.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize:'0.82rem', color:'var(--text-secondary)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>Anexos</h3>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {bug.attachments.map(att => (
                  <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background:'var(--bg-raised)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)', fontSize:'0.78rem', color:'var(--text-secondary)' }}>
                    {att.fileType==='IMAGE'?'🖼️':att.fileType==='VIDEO'?'🎥':'📄'} {att.originalName}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Comentários */}
          <div className="card">
            <h3 style={{ fontSize:'0.82rem', color:'var(--text-secondary)', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.05em' }}>Comentários ({bug.comments?.length||0})</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>
              {bug.comments?.map(c => {
                const name = c.author?.qaProfile?.name || c.author?.developerProfile?.name || c.author?.email || '?';
                return (
                  <div key={c.id} style={{ display:'flex', gap:10 }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--accent-dim)', border:'1px solid var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:600, color:'var(--accent)', flexShrink:0 }}>
                      {name.split(' ').slice(0,2).map(n=>n[0]).join('')}
                    </div>
                    <div>
                      <div style={{ display:'flex', gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:'0.78rem', fontWeight:600 }}>{name}</span>
                        <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{new Date(c.createdAt).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' })}</span>
                      </div>
                      <p style={{ fontSize:'0.83rem', color:'var(--text-secondary)', lineHeight:1.6 }}>{c.content}</p>
                    </div>
                  </div>
                );
              })}
              {bug.comments?.length === 0 && <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', textAlign:'center', padding:'12px 0' }}>Sem comentários ainda.</p>}
            </div>
            <form onSubmit={addComment} style={{ display:'flex', gap:8 }}>
              <textarea className="textarea" value={comment} onChange={e => setComment(e.target.value)} placeholder="Adicionar comentário…" rows={2} style={{ flex:1 }} />
              <button type="submit" className="btn btn-primary" disabled={!comment.trim()}>↑</button>
            </form>
          </div>
        </div>

        {/* Sidebar de detalhes */}
        <div style={{ display:'flex', flexDirection:'column', gap:16, position:'sticky', top:0 }}>
          <div className="card">
            <h3 style={{ fontSize:'0.78rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>Detalhes</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'Código',      value: <span style={{ fontFamily:'var(--font-mono)', color:'var(--accent)' }}>{bug.bugCode}</span> },
                { label:'Severidade',  value: <span style={{ fontWeight:700, color: SEV_COLOR[bug.severity] }}>● {bug.severity}</span> },
                { label:'Prioridade',  value: <span>{bug.priority}</span> },
                { label:'Reportado por', value: <span>{profile(bug.reportedBy)}</span> },
                { label:'Atribuído a', value: <span>{profile(bug.assignedTo) || '—'}</span> },
                { label:'Ambiente',    value: <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.75rem' }}>{bug.environment || '—'}</span> },
                { label:'Criado em',   value: <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.75rem' }}>{new Date(bug.createdAt).toLocaleDateString('pt-BR')}</span> },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:2 }}>{label}</p>
                  <div style={{ fontSize:'0.82rem' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize:'0.78rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Alterar status</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {Object.entries(STA_LABEL).map(([key, label]) => (
                <button key={key} onClick={() => updateStatus(key)} disabled={bug.status === key}
                  style={{ padding:'7px 12px', borderRadius:'var(--radius-md)', fontSize:'0.8rem', textAlign:'left', border:`1px solid ${bug.status===key ? STA_COLOR[key] : 'var(--border-subtle)'}`, background: bug.status===key ? `${STA_COLOR[key]}15` : 'transparent', color: bug.status===key ? STA_COLOR[key] : 'var(--text-secondary)', cursor: bug.status===key ? 'default' : 'pointer', transition:'all var(--t-fast)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
