// src/pages/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }  from '../context/contexts';
import { useToast } from '../context/contexts';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }  = useAuth();
  const { toast }  = useToast();
  const navigate   = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast('Login realizado com sucesso', 'success');
      navigate('/dashboard');
    } catch (err) {
      toast(err.response?.data?.message || 'Credenciais inválidas', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, backgroundImage:'radial-gradient(ellipse at 20% 50%, rgba(245,158,11,0.04) 0%, transparent 60%)' }}>
      <div className="animate-fade-up" style={{ width:'100%', maxWidth:380, background:'var(--bg-surface)', border:'1px solid var(--border-default)', borderRadius:'var(--radius-lg)', padding:36 }}>

        <span style={{ fontFamily:'var(--font-mono)', fontSize:'1.1rem', fontWeight:500, color:'var(--accent)', marginBottom:28, display:'block' }}>
          qa<span style={{ color:'var(--text-muted)' }}>/</span>platform
        </span>

        <h1 style={{ fontSize:'1.2rem', fontWeight:600, marginBottom:6, letterSpacing:'-0.02em' }}>
          Entrar na plataforma
        </h1>
        <p style={{ fontSize:'0.83rem', color:'var(--text-secondary)', marginBottom:28 }}>
          Gerencie qualidade com inteligência
        </p>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Senha</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:4 }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Entrar'}
          </button>
        </form>

        <div style={{ height:1, background:'var(--border-subtle)', margin:'20px 0' }} />

        <div style={{ background:'var(--bg-raised)', borderRadius:'var(--radius-md)', padding:12, fontSize:'0.76rem', color:'var(--text-muted)', lineHeight:1.8 }}>
          <strong style={{ color:'var(--text-secondary)', display:'block', marginBottom:4 }}>Contas de demonstração</strong>
          ADMIN: <span style={{ fontFamily:'var(--font-mono)', color:'var(--accent)' }}>admin@empresa.com</span><br/>
          QA: <span style={{ fontFamily:'var(--font-mono)', color:'var(--accent)' }}>qa1@empresa.com</span><br/>
          Dev: <span style={{ fontFamily:'var(--font-mono)', color:'var(--accent)' }}>dev1@empresa.com</span><br/>
          Senha: <span style={{ fontFamily:'var(--font-mono)', color:'var(--accent)' }}>Senha@123</span>
        </div>
      </div>
    </div>
  );
}
