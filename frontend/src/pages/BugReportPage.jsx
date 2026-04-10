// src/pages/BugReportPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate }      from 'react-router-dom';
import { useQuery, useQueryClient }    from '@tanstack/react-query';
import { api }        from '../services/api';
import { useProject } from '../context/contexts';
import { useToast }   from '../context/contexts';
import { useAuth }    from '../context/contexts';

const SEV_COLOR = { LOW:'var(--success)', MEDIUM:'var(--warning)', HIGH:'var(--danger)', CRITICAL:'var(--sev-critical)' };
const STA_COLOR = { OPEN:'var(--danger)', IN_PROGRESS:'var(--warning)', RESOLVED:'var(--info)', CLOSED:'var(--success)', REJECTED:'var(--text-muted)' };
const STA_LABEL = { OPEN:'Aberto', IN_PROGRESS:'Em andamento', RESOLVED:'Resolvido', CLOSED:'Fechado', REJECTED:'Rejeitado' };

function timeAgo(d) {
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 60) return `${m}m`; if (m < 1440) return `${Math.floor(m/60)}h`; return `${Math.floor(m/1440)}d`;
}

function BugCard({ bug, onClick }) {
  const assigned = bug.assignedTo?.developerProfile?.name;
  return (
    <div className="card" style={{ cursor:'pointer', transition:'border-color var(--t-fast)' }} onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-strong)'}
      onMouseLeave={e => e.currentTarget.style.borderColor=''}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--text-muted)' }}>{bug.bugCode}</span>
        <div style={{ display:'flex', gap:6 }}>
          <span style={{ fontSize:'0.7rem', fontWeight:700, color: SEV_COLOR[bug.severity] }}>● {bug.severity}</span>
          <span style={{ fontSize:'0.7rem', color:STA_COLOR[bug.status], background:`${STA_COLOR[bug.status]}18`, padding:'1px 7px', borderRadius:3, fontFamily:'var(--font-mono)' }}>{STA_LABEL[bug.status]}</span>
        </div>
      </div>
      <p style={{ fontWeight:600, fontSize:'0.87rem', marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{bug.title}</p>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid var(--border-subtle)', paddingTop:8 }}>
        <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{assigned || '—'}</span>
        <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{timeAgo(bug.createdAt)}</span>
      </div>
    </div>
  );
}

function CreateModal({ projectId, onClose, onCreated }) {
  const [form, setForm] = useState({ title:'', description:'', severity:'MEDIUM', priority:'MEDIUM', expectedResult:'', actualResult:'', environment:'', assignedToId:'', stepsToRepro:[''] });
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const { toast } = useToast();

  const { data: devsData } = useQuery({ queryKey:['developers'], queryFn: () => api.get('/users/developers').then(r => r.data.data.developers) });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/bugs`, { ...form, stepsToRepro: form.stepsToRepro.filter(Boolean), assignedToId: form.assignedToId || undefined });
      const bugId = data.data.bug.id;
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file);
        await api.post(`/projects/${projectId}/bugs/${bugId}/attachments`, fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      }
      onCreated(); toast('Bug reportado!', 'success'); onClose();
    } catch (err) { toast(err.response?.data?.message || 'Erro', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade-up" style={{ maxWidth:600 }}>
        <div className="modal-header">
          <h2 style={{ fontSize:'1rem', fontWeight:600 }}>Reportar bug</h2>
          <button onClick={onClose} style={{ color:'var(--text-muted)', fontSize:'1.2rem' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group"><label className="form-label">Título *</label><input className="input" value={form.title} onChange={set('title')} required /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group"><label className="form-label">Severidade</label>
              <select className="select" value={form.severity} onChange={set('severity')}>{['LOW','MEDIUM','HIGH','CRITICAL'].map(s=><option key={s}>{s}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Prioridade</label>
              <select className="select" value={form.priority} onChange={set('priority')}>{['LOW','MEDIUM','HIGH','URGENT'].map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div className="form-group"><label className="form-label">Descrição *</label><textarea className="textarea" value={form.description} onChange={set('description')} required rows={3} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group"><label className="form-label">Resultado esperado *</label><textarea className="textarea" value={form.expectedResult} onChange={set('expectedResult')} required rows={2} /></div>
            <div className="form-group"><label className="form-label">Resultado atual *</label><textarea className="textarea" value={form.actualResult} onChange={set('actualResult')} required rows={2} /></div>
          </div>
          <div className="form-group">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <label className="form-label" style={{ marginBottom:0 }}>Passos</label>
              <button type="button" onClick={() => setForm(p => ({ ...p, stepsToRepro:[...p.stepsToRepro,''] }))} style={{ fontSize:'0.75rem', color:'var(--accent)' }}>+ Adicionar</button>
            </div>
            {form.stepsToRepro.map((s,i) => (
              <div key={i} style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)', minWidth:20 }}>{i+1}.</span>
                <input className="input" value={s} onChange={e => setForm(p => ({ ...p, stepsToRepro: p.stepsToRepro.map((x,j)=>j===i?e.target.value:x) }))} placeholder={`Passo ${i+1}`} style={{ flex:1 }} />
                {form.stepsToRepro.length > 1 && <button type="button" onClick={() => setForm(p => ({ ...p, stepsToRepro: p.stepsToRepro.filter((_,j)=>j!==i) }))} style={{ color:'var(--text-muted)' }}>✕</button>}
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group"><label className="form-label">Atribuir ao dev</label>
              <select className="select" value={form.assignedToId} onChange={set('assignedToId')}>
                <option value="">— Nenhum —</option>
                {(devsData||[]).map(d=><option key={d.id} value={d.id}>{d.developerProfile?.name||d.email}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Ambiente</label><input className="input" value={form.environment} onChange={set('environment')} placeholder="Ex: Chrome 125" /></div>
          </div>
          <div className="form-group">
            <label className="form-label">Anexos</label>
            <div onClick={() => fileRef.current?.click()} style={{ border:'1px dashed var(--border-default)', borderRadius:'var(--radius-md)', padding:16, textAlign:'center', cursor:'pointer', background:'var(--bg-raised)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor=''}>
              <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf" style={{ display:'none' }} onChange={e => setFiles(Array.from(e.target.files))} />
              {files.length === 0 ? <p style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>Clique para anexar imagens, vídeos ou PDFs</p> :
                files.map((f,i) => <p key={i} style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>📎 {f.name}</p>)}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <span className="spinner" /> : 'Reportar bug'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BugReportPage() {
  const { projectId } = useParams();
  const navigate      = useNavigate();
  const { currentProject, loadProject } = useProject();
  const queryClient   = useQueryClient();
  const { isQA }      = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters]     = useState({ status:'', severity:'' });

  useEffect(() => { loadProject(projectId); }, [projectId]);

  const { data, isLoading } = useQuery({
    queryKey: ['bugs', projectId, filters],
    queryFn:  () => api.get(`/projects/${projectId}/bugs`, { params:{ status:filters.status||undefined, severity:filters.severity||undefined } }).then(r => r.data.data),
  });

  const bugs = data?.bugs || [];
  const cols = [
    { key:'OPEN',        label:'Abertos',      color:'var(--danger)' },
    { key:'IN_PROGRESS', label:'Em andamento',  color:'var(--warning)' },
    { key:'RESOLVED',    label:'Resolvidos',    color:'var(--info)' },
    { key:'CLOSED',      label:'Fechados',      color:'var(--success)' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ marginBottom:4 }}>Bug Reports</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>{currentProject?.name} · {bugs.length} bug{bugs.length!==1?'s':''}</p>
        </div>
        {isQA && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Reportar bug</button>}
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        <select className="select" style={{ width:160 }} value={filters.status} onChange={e => setFilters(p=>({...p,status:e.target.value}))}>
          <option value="">Todos os status</option>
          {Object.entries(STA_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="select" style={{ width:160 }} value={filters.severity} onChange={e => setFilters(p=>({...p,severity:e.target.value}))}>
          <option value="">Todas as severidades</option>
          {['LOW','MEDIUM','HIGH','CRITICAL'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><span className="spinner" style={{ width:28, height:28 }} /></div>
      ) : bugs.length === 0 ? (
        <div className="card"><div className="empty-state"><span className="empty-state__icon">🐛</span><p className="empty-state__title">Nenhum bug encontrado</p></div></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, alignItems:'start' }}>
          {cols.map(col => {
            const colBugs = bugs.filter(b => b.status === col.key);
            return (
              <div key={col.key}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:col.color, flexShrink:0 }} />
                  <span style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-secondary)' }}>{col.label}</span>
                  <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginLeft:'auto', fontFamily:'var(--font-mono)' }}>{colBugs.length}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {colBugs.map(bug => <BugCard key={bug.id} bug={bug} onClick={() => navigate(`/projects/${projectId}/bugs/${bug.id}`)} />)}
                  {colBugs.length === 0 && <div style={{ padding:20, border:'1px dashed var(--border-subtle)', borderRadius:'var(--radius-md)', textAlign:'center', color:'var(--text-muted)', fontSize:'0.78rem' }}>Vazio</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <CreateModal projectId={projectId} onClose={() => setShowModal(false)} onCreated={() => queryClient.invalidateQueries({ queryKey:['bugs', projectId] })} />}
    </div>
  );
}
