// src/components/AI/AIAssistantPanel.jsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { useProject } from '../../context/contexts';
import { api }        from '../../services/api';

const TABS = [
  { id:'chat',      label:'💬 Agente QA',       desc:'Converse com o assistente' },
  { id:'scenarios', label:'🧪 Gerar Cenários',   desc:'Cenários a partir de regras' },
  { id:'bug',       label:'🐛 Gerar Bug Report', desc:'IA preenche o formulário' },
  { id:'risk',      label:'⚠️ Analisar Risco',   desc:'Classificação LOW/MEDIUM/HIGH' },
];

export default function AIAssistantPanel() {
  const { currentProject, businessRules } = useProject();
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Header */}
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:'16px 20px', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--accent-dim)', border:'1px solid var(--accent-glow)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>✦</div>
          <div>
            <h2 style={{ fontSize:'0.95rem', fontWeight:600 }}>Assistente IA</h2>
            <p style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
              Powered by Claude · {currentProject ? currentProject.name : 'Nenhum projeto selecionado'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, background:'var(--bg-raised)', borderRadius:'var(--radius-md)', padding:3 }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ flex:1, padding:'6px 4px', borderRadius:6, fontSize:'0.72rem', fontWeight:500, textAlign:'center', background: activeTab===tab.id ? 'var(--bg-overlay)' : 'transparent', color: activeTab===tab.id ? 'var(--text-primary)' : 'var(--text-muted)', transition:'all var(--t-fast)', border:'none', cursor:'pointer', whiteSpace:'nowrap' }}
              title={tab.desc}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo da tab */}
      <div style={{ flex:1, minHeight:0 }}>
        {activeTab === 'chat'      && <ChatTab      projectId={currentProject?.id} />}
        {activeTab === 'scenarios' && <ScenariosTab projectId={currentProject?.id} rules={businessRules} />}
        {activeTab === 'bug'       && <BugGenTab    projectId={currentProject?.id} />}
        {activeTab === 'risk'      && <RiskTab />}
      </div>
    </div>
  );
}

// ── TAB: CHAT ─────────────────────────────────────
function ChatTab({ projectId }) {
  const [messages, setMessages] = useState([
    { role:'assistant', content:'Olá! Sou seu assistente de QA. Posso criar cenários de teste, analisar regras de negócio ou ajudar com bug reports. Como posso ajudar?' }
  ]);
  const [input, setInput]         = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  const abortRef       = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg    = { role:'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);
    setMessages(prev => [...prev, { role:'assistant', content:'', isStreaming:true }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ messages: newMessages, projectId }),
        signal: controller.signal,
      });

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const raw = line.replace('data: ', '');
          if (raw === '[DONE]') break;
          try {
            const { text } = JSON.parse(raw);
            fullText += text;
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role:'assistant', content:fullText, isStreaming:true };
              return updated;
            });
          } catch { /* ignorar chunks malformados */ }
        }
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role:'assistant', content:fullText };
        return updated;
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role:'assistant', content:'Erro ao conectar com a IA. Verifique a ANTHROPIC_API_KEY no .env.', isError:true };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
    }
  }, [input, messages, projectId, isStreaming]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
      {/* Mensagens */}
      <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', flexDirection: msg.role==='user' ? 'row-reverse' : 'row' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background: msg.role==='user' ? 'var(--info-dim)' : 'var(--accent-dim)', border:`1px solid ${msg.role==='user' ? 'rgba(59,130,246,0.3)' : 'var(--accent-glow)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:600, color: msg.role==='user' ? 'var(--info)' : 'var(--accent)', flexShrink:0 }}>
              {msg.role==='user' ? '👤' : '✦'}
            </div>
            <div style={{ maxWidth:'80%', padding:'10px 14px', borderRadius: msg.role==='user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px', background: msg.role==='user' ? 'var(--info-dim)' : 'var(--bg-raised)', border:`1px solid ${msg.role==='user' ? 'rgba(59,130,246,0.15)' : 'var(--border-subtle)'}`, fontSize:'0.83rem', lineHeight:1.7, color: msg.isError ? 'var(--danger)' : 'var(--text-primary)', whiteSpace:'pre-wrap' }}>
              {msg.content}
              {msg.isStreaming && <span style={{ display:'inline-block', width:8, height:14, background:'var(--accent)', marginLeft:2, borderRadius:2, animation:'fadeIn 0.5s ease infinite alternate' }} />}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding:12, borderTop:'1px solid var(--border-subtle)', display:'flex', gap:8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Digite sua pergunta… (Enter para enviar, Shift+Enter para nova linha)"
          disabled={isStreaming}
          rows={2}
          style={{ flex:1, padding:'8px 12px', background:'var(--bg-base)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', fontSize:'0.83rem', outline:'none', resize:'none', fontFamily:'var(--font-sans)' }}
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
          className="btn btn-primary"
          style={{ alignSelf:'flex-end', padding:'8px 14px' }}
        >
          {isStreaming ? <span className="spinner" style={{ width:14, height:14 }} /> : '↑'}
        </button>
      </div>
    </div>
  );
}

// ── TAB: CENÁRIOS ─────────────────────────────────
function ScenariosTab({ projectId, rules }) {
  const [selected, setSelected] = useState([]);
  const [count,    setCount]    = useState(3);
  const [loading,  setLoading]  = useState(false);
  const [scenarios, setScenarios] = useState(null);
  const [error,    setError]    = useState(null);

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x!==id) : [...prev, id]);

  const generate = async () => {
    if (!selected.length) return;
    setLoading(true); setError(null);
    try {
      const { data } = await api.post('/ai/generate-scenarios', { ruleIds: selected, projectId, count });
      setScenarios(data.data.scenarios);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao gerar cenários. Verifique a ANTHROPIC_API_KEY.');
    } finally { setLoading(false); }
  };

  const riskColor = { LOW:'var(--success)', MEDIUM:'var(--warning)', HIGH:'var(--danger)' };
  const outColor  = { VALID:'var(--success)', INVALID:'var(--danger)' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:16 }}>
        <h3 style={{ fontSize:'0.82rem', color:'var(--text-secondary)', marginBottom:12 }}>Selecione as regras de negócio</h3>

        {!rules?.length ? (
          <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', textAlign:'center', padding:'16px 0' }}>Nenhuma regra cadastrada neste projeto.</p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
            {rules.map(rule => (
              <label key={rule.id} onClick={() => toggle(rule.id)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:'var(--radius-md)', border:`1px solid ${selected.includes(rule.id) ? 'var(--accent)' : 'var(--border-subtle)'}`, background: selected.includes(rule.id) ? 'var(--accent-dim)' : 'var(--bg-raised)', cursor:'pointer', transition:'all var(--t-fast)' }}>
                <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${selected.includes(rule.id) ? 'var(--accent)' : 'var(--border-strong)'}`, background: selected.includes(rule.id) ? 'var(--accent)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'0.65rem', color:'var(--text-inverse)' }}>
                  {selected.includes(rule.id) && '✓'}
                </div>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--accent)', background:'var(--accent-dim)', padding:'1px 6px', borderRadius:3, flexShrink:0 }}>{rule.ruleCode}</span>
                <span style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>{rule.description}</span>
              </label>
            ))}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <label style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>Cenários:</label>
          <select className="select" value={count} onChange={e => setCount(Number(e.target.value))} style={{ width:80 }}>
            {[1,2,3,5,8].map(n => <option key={n}>{n}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={generate} disabled={loading || !selected.length} style={{ marginLeft:'auto' }}>
            {loading ? <><span className="spinner" style={{ width:12, height:12 }} /> Gerando…</> : '✦ Gerar com IA'}
          </button>
        </div>

        {error && <p style={{ fontSize:'0.78rem', color:'var(--danger)', marginTop:10, padding:'8px 12px', background:'var(--danger-dim)', borderRadius:'var(--radius-md)' }}>{error}</p>}
      </div>

      {scenarios && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <h3 style={{ fontSize:'0.82rem', color:'var(--text-secondary)' }}>Cenários gerados ({scenarios.length})</h3>
          {scenarios.map((s, i) => (
            <div key={i} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, gap:8 }}>
                <p style={{ fontWeight:600, fontSize:'0.85rem', flex:1 }}>{s.title}</p>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <span style={{ fontSize:'0.7rem', fontWeight:600, color: outColor[s.output], fontFamily:'var(--font-mono)' }}>{s.output}</span>
                  <span style={{ fontSize:'0.7rem', fontWeight:600, color: riskColor[s.riskLevel] }}>● {s.riskLevel}</span>
                </div>
              </div>
              <p style={{ fontSize:'0.78rem', color:'var(--text-secondary)', marginBottom:10 }}><strong>Esperado:</strong> {s.expectedResult}</p>
              <button
                onClick={() => { window.dispatchEvent(new CustomEvent('importScenario', { detail: s })); }}
                style={{ fontSize:'0.75rem', color:'var(--accent)', background:'var(--accent-dim)', border:'1px solid var(--accent-glow)', padding:'4px 10px', borderRadius:'var(--radius-sm)', cursor:'pointer' }}>
                + Importar como caso de teste
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TAB: BUG REPORT ───────────────────────────────
function BugGenTab({ projectId }) {
  const [description, setDescription] = useState('');
  const [context,     setContext]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState(null);

  const generate = async () => {
    if (!description.trim()) return;
    setLoading(true); setError(null);
    try {
      const { data } = await api.post('/ai/generate-bug-report', { description, context, projectId });
      setResult(data.data.bugReport);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao gerar bug report. Verifique a ANTHROPIC_API_KEY.');
    } finally { setLoading(false); }
  };

  const sevColor = { LOW:'var(--success)', MEDIUM:'var(--warning)', HIGH:'var(--danger)', CRITICAL:'var(--sev-critical)' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:16 }}>
        <div className="form-group" style={{ marginBottom:12 }}>
          <label className="form-label">Descreva o problema encontrado *</label>
          <textarea className="textarea" value={description} onChange={e => setDescription(e.target.value)} rows={4}
            placeholder="Ex: Ao clicar no botão salvar, a página retorna erro 500 e nenhum dado é persistido no banco..." />
        </div>
        <div className="form-group" style={{ marginBottom:14 }}>
          <label className="form-label">Contexto adicional <span style={{ color:'var(--text-muted)' }}>(opcional)</span></label>
          <textarea className="textarea" value={context} onChange={e => setContext(e.target.value)} rows={2}
            placeholder="Ambiente, versão, frequência, usuário afetado..." />
        </div>
        <button className="btn btn-primary btn-sm" onClick={generate} disabled={loading || !description.trim()}>
          {loading ? <><span className="spinner" style={{ width:12, height:12 }} /> Gerando…</> : '✦ Gerar Bug Report com IA'}
        </button>
        {error && <p style={{ fontSize:'0.78rem', color:'var(--danger)', marginTop:10, padding:'8px 12px', background:'var(--danger-dim)', borderRadius:'var(--radius-md)' }}>{error}</p>}
      </div>

      {result && (
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
            <p style={{ fontWeight:600, fontSize:'0.9rem', flex:1, marginRight:12 }}>{result.title}</p>
            <div style={{ display:'flex', gap:8 }}>
              <span style={{ fontSize:'0.72rem', fontWeight:700, color: sevColor[result.severity] }}>● {result.severity}</span>
              <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{result.priority}</span>
            </div>
          </div>
          <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:10 }}>{result.description}</p>
          {result.stepsToRepro?.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <p style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Passos</p>
              <ol style={{ paddingLeft:16, fontSize:'0.78rem', color:'var(--text-secondary)', lineHeight:1.8 }}>
                {result.stepsToRepro.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div>
              <p style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--success)', marginBottom:3 }}>✓ Esperado</p>
              <p style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>{result.expectedResult}</p>
            </div>
            <div>
              <p style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--danger)', marginBottom:3 }}>✕ Atual</p>
              <p style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>{result.actualResult}</p>
            </div>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('importBugReport', { detail: result }))}
            style={{ fontSize:'0.75rem', color:'var(--accent)', background:'var(--accent-dim)', border:'1px solid var(--accent-glow)', padding:'4px 10px', borderRadius:'var(--radius-sm)', cursor:'pointer' }}>
            + Importar para formulário de bug
          </button>
        </div>
      )}
    </div>
  );
}

// ── TAB: RISCO ────────────────────────────────────
function RiskTab() {
  const [form, setForm] = useState({ title:'', description:'', expectedResult:'', ruleDescription:'' });
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const analyze = async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.post('/ai/suggest-risk', {
        title: form.title, description: form.description,
        expectedResult: form.expectedResult, businessRuleDescription: form.ruleDescription,
      });
      setResult(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao analisar risco. Verifique a ANTHROPIC_API_KEY.');
    } finally { setLoading(false); }
  };

  const riskColor = { LOW:'var(--success)', MEDIUM:'var(--warning)', HIGH:'var(--danger)' };
  const riskBg    = { LOW:'var(--success-dim)', MEDIUM:'var(--warning-dim)', HIGH:'var(--danger-dim)' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', padding:16 }}>
        {[
          { label:'Título do cenário *', key:'title',           placeholder:'Ex: Adicionar 51º item ao carrinho' },
          { label:'Descrição',           key:'description',     placeholder:'Detalhe o que o cenário testa' },
          { label:'Resultado esperado',  key:'expectedResult',  placeholder:'O que deve acontecer' },
          { label:'Regra de negócio',    key:'ruleDescription', placeholder:'Descrição da regra relacionada' },
        ].map(f => (
          <div key={f.key} className="form-group" style={{ marginBottom:10 }}>
            <label className="form-label">{f.label}</label>
            <input className="input" value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder} />
          </div>
        ))}
        <button className="btn btn-primary btn-sm" onClick={analyze} disabled={loading || !form.title} style={{ marginTop:4 }}>
          {loading ? <><span className="spinner" style={{ width:12, height:12 }} /> Analisando…</> : '✦ Analisar Risco com IA'}
        </button>
        {error && <p style={{ fontSize:'0.78rem', color:'var(--danger)', marginTop:10, padding:'8px 12px', background:'var(--danger-dim)', borderRadius:'var(--radius-md)' }}>{error}</p>}
      </div>

      {result && (
        <div style={{ background: riskBg[result.riskLevel], border:`1px solid ${riskColor[result.riskLevel]}40`, borderRadius:'var(--radius-lg)', padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:'1.5rem', fontWeight:700, color: riskColor[result.riskLevel], fontFamily:'var(--font-mono)' }}>● {result.riskLevel}</span>
          </div>
          <p style={{ fontSize:'0.83rem', color:'var(--text-secondary)', lineHeight:1.7, marginBottom:12 }}>{result.justification}</p>
          {result.factors?.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {result.factors.map((f, i) => (
                <span key={i} style={{ fontSize:'0.72rem', padding:'3px 10px', background:'rgba(0,0,0,0.2)', borderRadius:'var(--radius-sm)', color:'var(--text-secondary)' }}>{f}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
