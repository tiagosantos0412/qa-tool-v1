// src/pages/TestCasesPage.jsx
import { useState, useEffect } from 'react';
import { useParams }           from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api }        from '../services/api';
import { useProject } from '../context/contexts';
import { useToast }   from '../context/contexts';
import { useAuth }    from '../context/contexts';

const RISK_COLOR   = { LOW:'var(--success)', MEDIUM:'var(--warning)', HIGH:'var(--danger)' };
const OUTPUT_COLOR = { VALID:'var(--success)', INVALID:'var(--danger)' };
const RUN_STATUS   = { PASSED:{ label:'Passou', color:'var(--success)' }, FAILED:{ label:'Falhou', color:'var(--danger)' }, RUNNING:{ label:'Rodando…', color:'var(--warning)' }, ERROR:{ label:'Erro', color:'var(--sev-critical)' }, PENDING:{ label:'Pendente', color:'var(--text-muted)' } };

function RunButton({ testCaseId, lastRun, onDone }) {
  const [status, setStatus] = useState(lastRun?.status || null);
  const [runId,  setRunId]  = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!runId || status !== 'RUNNING') return;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/cypress/status/${runId}`);
        const s = data.data.run.status;
        setStatus(s);
        if (s !== 'RUNNING') {
          clearInterval(interval);
          if (s === 'PASSED') toast('✓ Teste passou!', 'success');
          if (s === 'FAILED') toast('✕ Teste falhou', 'error');
          onDone?.();
        }
      } catch { clearInterval(interval); }
    }, 3000);
    return () => clearInterval(interval);
  }, [runId, status]);

  const handleRun = async (e) => {
    e.stopPropagation();
    setStatus('RUNNING');
    try {
      const { data } = await api.post(`/cypress/run/${testCaseId}`);
      setRunId(data.data.runId);
      toast('Executando Cypress…', 'info');
    } catch {
      setStatus(null);
      toast('Erro ao iniciar teste', 'error');
    }
  };

  const rs = status ? RUN_STATUS[status] : null;

  return (
    <button onClick={handleRun} disabled={status === 'RUNNING'} className="btn btn-ghost btn-sm"
      style={{ fontSize:'0.72rem', gap:5, color: rs?.color || 'var(--text-secondary)' }}>
      {status === 'RUNNING' ? <><span className="spinner" style={{ width:11, height:11, borderWidth:1.5 }} /> Rodando</> :
       status === 'PASSED'  ? '✓ Passou' :
       status === 'FAILED'  ? '✕ Falhou' : '▶ Run'}
    </button>
  );
}

function CreateModal({ projectId, rules, onClose, onCreated }) {
  const [form, setForm] = useState({ title:'', expectedResult:'', output:'VALID', riskLevel:'MEDIUM', businessRuleId:'', steps:[''] });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/test-cases`, {
        ...form, steps: form.steps.filter(Boolean), businessRuleId: form.businessRuleId || undefined,
      });
      onCreated(data.data.testCase);
      toast('Caso de teste criado!', 'success');
      onClose();
    } catch (err) {
      toast(err.response?.data?.message || 'Erro', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade-up" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <h2 style={{ fontSize:'1rem', fontWeight:600 }}>Novo caso de teste</h2>
          <button onClick={onClose} style={{ color:'var(--text-muted)', fontSize:'1.2rem' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="input" value={form.title} onChange={set('title')} required placeholder="Ex: Login sem autenticação deve redirecionar" />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label className="form-label">Output *</label>
              <select className="select" value={form.output} onChange={set('output')}>
                <option value="VALID">VALID — fluxo feliz</option>
                <option value="INVALID">INVALID — caso de erro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Risco</label>
              <select className="select" value={form.riskLevel} onChange={set('riskLevel')}>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Regra de negócio</label>
            <select className="select" value={form.businessRuleId} onChange={set('businessRuleId')}>
              <option value="">— Nenhuma —</option>
              {rules.map(r => <option key={r.id} value={r.id}>[{r.ruleCode}] {r.description.slice(0,50)}…</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Resultado esperado *</label>
            <textarea className="textarea" value={form.expectedResult} onChange={set('expectedResult')} rows={2} required placeholder="O que o sistema deve fazer?" />
          </div>
          <div className="form-group">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <label className="form-label" style={{ marginBottom:0 }}>Passos</label>
              <button type="button" onClick={() => setForm(p => ({ ...p, steps: [...p.steps, ''] }))} style={{ fontSize:'0.75rem', color:'var(--accent)' }}>+ Adicionar</button>
            </div>
            {form.steps.map((s, i) => (
              <div key={i} style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:'0.75rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)', minWidth:20, textAlign:'right' }}>{i+1}.</span>
                <input className="input" value={s} onChange={e => setForm(p => ({ ...p, steps: p.steps.map((x,j) => j===i ? e.target.value : x) }))} placeholder={`Passo ${i+1}`} style={{ flex:1 }} />
                {form.steps.length > 1 && <button type="button" onClick={() => setForm(p => ({ ...p, steps: p.steps.filter((_,j) => j!==i) }))} style={{ color:'var(--text-muted)' }}>✕</button>}
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <span className="spinner" /> : 'Criar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TestCasesPage() {
  const { projectId }  = useParams();
  const { currentProject, businessRules, loadProject } = useProject();
  const queryClient    = useQueryClient();
  const { isQA }       = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters]     = useState({ output:'', riskLevel:'' });

  useEffect(() => { loadProject(projectId); }, [projectId]);

  const { data, isLoading } = useQuery({
    queryKey: ['test-cases', projectId, filters],
    queryFn:  () => api.get(`/projects/${projectId}/test-cases`, { params: { output: filters.output||undefined, riskLevel: filters.riskLevel||undefined } }).then(r => r.data.data),
  });

  const testCases = data?.testCases || [];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ marginBottom:4 }}>Casos de Teste</h1>
          <p style={{ color:'var(--text-secondary)', fontSize:'0.85rem' }}>{currentProject?.name} · {testCases.length} caso{testCases.length !== 1 ? 's' : ''}</p>
        </div>
        {isQA && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Novo caso</button>}
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        <select className="select" style={{ width:160 }} value={filters.output} onChange={e => setFilters(p => ({ ...p, output: e.target.value }))}>
          <option value="">Todos outputs</option>
          <option value="VALID">VALID</option>
          <option value="INVALID">INVALID</option>
        </select>
        <select className="select" style={{ width:160 }} value={filters.riskLevel} onChange={e => setFilters(p => ({ ...p, riskLevel: e.target.value }))}>
          <option value="">Todos riscos</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
        </select>
      </div>

      <div className="card" style={{ padding:0 }}>
        {isLoading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}><span className="spinner" style={{ width:28, height:28 }} /></div>
        ) : testCases.length === 0 ? (
          <div className="empty-state"><span className="empty-state__icon">🧪</span><p className="empty-state__title">Nenhum caso de teste</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Código</th><th>Título</th><th>Regra</th><th>Output</th><th>Risco</th><th>Último run</th><th></th></tr></thead>
              <tbody>
                {testCases.map(tc => (
                  <tr key={tc.id}>
                    <td><span style={{ fontFamily:'var(--font-mono)', fontSize:'0.75rem', color:'var(--accent)' }}>{tc.testCode}</span></td>
                    <td style={{ maxWidth:280 }}><p style={{ fontWeight:500, fontSize:'0.83rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tc.title}</p></td>
                    <td>{tc.businessRule ? <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--accent)', background:'var(--accent-dim)', padding:'2px 6px', borderRadius:4 }}>{tc.businessRule.ruleCode}</span> : <span style={{ color:'var(--text-muted)', fontSize:'0.75rem' }}>—</span>}</td>
                    <td><span style={{ fontSize:'0.72rem', fontWeight:600, color: OUTPUT_COLOR[tc.output], fontFamily:'var(--font-mono)' }}>{tc.output}</span></td>
                    <td><span style={{ fontSize:'0.72rem', fontWeight:600, color: RISK_COLOR[tc.riskLevel] }}>● {tc.riskLevel}</span></td>
                    <td>{tc.cypressRuns?.[0] ? <span style={{ fontSize:'0.72rem', color: RUN_STATUS[tc.cypressRuns[0].status]?.color, fontFamily:'var(--font-mono)' }}>{RUN_STATUS[tc.cypressRuns[0].status]?.label}</span> : <span style={{ color:'var(--text-muted)', fontSize:'0.72rem' }}>—</span>}</td>
                    <td><RunButton testCaseId={tc.id} lastRun={tc.cypressRuns?.[0]} onDone={() => queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <CreateModal projectId={projectId} rules={businessRules} onClose={() => setShowModal(false)} onCreated={() => queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })} />}
    </div>
  );
}
