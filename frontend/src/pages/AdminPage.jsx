// src/pages/AdminPage.jsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useToast } from '../context/contexts';

// ── Helpers ──────────────────────────────────────
const ROLE_LABEL  = { QA: 'QA', DEVELOPER: 'Developer', ADMIN: 'Admin' };
const ROLE_COLOR  = { QA: 'var(--info)', DEVELOPER: 'var(--success)', ADMIN: 'var(--accent)' };
const EXP_LEVELS  = ['JUNIOR', 'MID', 'SENIOR', 'LEAD'];

function Badge({ role }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 4,
      fontSize: '0.72rem', fontWeight: 600,
      fontFamily: 'var(--font-mono)',
      background: `${ROLE_COLOR[role]}22`,
      color: ROLE_COLOR[role],
    }}>
      {ROLE_LABEL[role]}
    </span>
  );
}

// ── Modal de criação ─────────────────────────────
function CreateUserModal({ onClose, onCreated }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', role: 'QA', name: '',
    experienceLevel: 'JUNIOR', techStack: '', team: '',
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        email:    form.email,
        password: form.password,
        role:     form.role,
        name:     form.name,
        ...(form.role === 'QA'        && { experienceLevel: form.experienceLevel }),
        ...(form.role === 'DEVELOPER' && {
          techStack: form.techStack.split(',').map(s => s.trim()).filter(Boolean),
          team:      form.team || undefined,
        }),
      };
      const { data } = await api.post('/admin/users', payload);
      onCreated(data.data.user);
      toast(`Usuário ${form.name} criado!`, 'success');
      onClose();
    } catch (err) {
      toast(err.response?.data?.message || 'Erro ao criar usuário', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade-up" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1rem' }}>Novo usuário</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Nome completo *</label>
              <input className="input" value={form.name} onChange={set('name')} required placeholder="Ana Paula Costa" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">E-mail *</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} required placeholder="ana@empresa.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Senha *</label>
              <input className="input" type="password" value={form.password} onChange={set('password')} required minLength={8} placeholder="Mín. 8 caracteres" />
            </div>
            <div className="form-group">
              <label className="form-label">Papel *</label>
              <select className="select" value={form.role} onChange={set('role')}>
                <option value="QA">QA</option>
                <option value="DEVELOPER">Developer</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>

          {/* Campos específicos do papel */}
          {form.role === 'QA' && (
            <div className="form-group">
              <label className="form-label">Nível de experiência</label>
              <select className="select" value={form.experienceLevel} onChange={set('experienceLevel')}>
                {EXP_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}
          {form.role === 'DEVELOPER' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Stack (separada por vírgula)</label>
                <input className="input" value={form.techStack} onChange={set('techStack')} placeholder="React, Node.js, PostgreSQL" />
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input className="input" value={form.team} onChange={set('team')} placeholder="Core, Payments..." />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de edição / reset de senha ─────────────
function EditUserModal({ user, onClose, onUpdated }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const profile  = user.qaProfile || user.developerProfile;
  const [form, setForm] = useState({
    name:            profile?.name            || '',
    experienceLevel: user.qaProfile?.experienceLevel || 'JUNIOR',
    techStack:       user.developerProfile?.techStack?.join(', ') || '',
    team:            user.developerProfile?.team || '',
    newPassword:     '',
    isActive:        user.isActive,
  });
  const set = k => e => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(p => ({ ...p, [k]: v }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        isActive:    form.isActive,
        ...(form.name             && { name: form.name }),
        ...(form.newPassword      && { newPassword: form.newPassword }),
        ...(user.role === 'QA'        && { experienceLevel: form.experienceLevel }),
        ...(user.role === 'DEVELOPER' && {
          techStack: form.techStack.split(',').map(s => s.trim()).filter(Boolean),
          team:      form.team || null,
        }),
      };
      const { data } = await api.patch(`/admin/users/${user.id}`, payload);
      onUpdated(data.data.user);
      toast('Usuário atualizado!', 'success');
      onClose();
    } catch (err) {
      toast(err.response?.data?.message || 'Erro ao atualizar', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-fade-up" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1rem' }}>Editar usuário</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{user.email}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">

          <div className="form-group">
            <label className="form-label">Nome</label>
            <input className="input" value={form.name} onChange={set('name')} />
          </div>

          {user.role === 'QA' && (
            <div className="form-group">
              <label className="form-label">Nível de experiência</label>
              <select className="select" value={form.experienceLevel} onChange={set('experienceLevel')}>
                {EXP_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}
          {user.role === 'DEVELOPER' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Stack</label>
                <input className="input" value={form.techStack} onChange={set('techStack')} />
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input className="input" value={form.team} onChange={set('team')} />
              </div>
            </div>
          )}

          {/* Resetar senha */}
          <div className="form-group">
            <label className="form-label">Nova senha (deixe em branco para não alterar)</label>
            <input className="input" type="password" value={form.newPassword}
              onChange={set('newPassword')} placeholder="Mín. 8 caracteres" minLength={form.newPassword ? 8 : 0} />
          </div>

          {/* Ativar / desativar */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                           padding: '10px 12px', background: 'var(--bg-raised)',
                           borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
            Conta ativa
            {!form.isActive && (
              <span style={{ marginLeft: 4, fontSize: '0.75rem', color: 'var(--danger)' }}>
                (usuário não consegue fazer login)
              </span>
            )}
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────
export default function AdminPage() {
  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const { data: statsData } = useQuery({
    queryKey: ['admin-stats'],
    queryFn:  () => api.get('/admin/stats').then(r => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter],
    queryFn:  () => api.get('/admin/users', {
      params: { search: search || undefined, role: roleFilter || undefined },
    }).then(r => r.data.data),
  });

  const users = data?.users || [];
  const stats = statsData;

  const handleCreated = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  const handleUpdated = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const handleDeactivate = async (user) => {
    if (!confirm(`Desativar a conta de ${user.qaProfile?.name || user.developerProfile?.name || user.email}?`)) return;
    try {
      await api.delete(`/admin/users/${user.id}`);
      toast('Conta desativada', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast(err.response?.data?.message || 'Erro', 'error');
    }
  };

  const handleDelete = async (user) => {
    const profile = user.qaProfile || user.developerProfile;
    const name    = profile?.name || user.email;

    if (!confirm(`ATENÇÃO: Deletar permanentemente a conta de ${name}?\n\nEsta ação remove o usuário do banco e não pode ser desfeita.`)) return;

    try {
      await api.delete(`/admin/users/${user.id}?permanent=true`);
      toast(`Usuário ${name} deletado permanentemente`, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast(err.response?.data?.message || 'Erro ao deletar', 'error');
    }
  };

  return (
    <div className="animate-fade-up">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>Painel Admin</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Gestão de usuários e permissões
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Novo usuário
        </button>
      </div>

      {/* Cards de stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total usuários', value: stats.users.total,    color: 'var(--text-primary)' },
            { label: 'QAs',            value: stats.users.qa,       color: 'var(--info)'    },
            { label: 'Developers',     value: stats.users.developer, color: 'var(--success)' },
            { label: 'Ativos',         value: stats.users.active,   color: 'var(--accent)'  },
          ].map(({ label, value, color }) => (
            <div key={label} className="card">
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase',
                           letterSpacing: '0.06em', marginBottom: 6 }}>{label}</p>
              <p style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input className="input" style={{ maxWidth: 260 }}
          placeholder="Buscar por nome ou e-mail..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 160 }}
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">Todos os papéis</option>
          <option value="QA">QA</option>
          <option value="DEVELOPER">Developer</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <span className="spinner" style={{ width: 24, height: 24 }} />
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state"><p>Nenhum usuário encontrado.</p></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Papel</th>
                <th>Detalhes</th>
                <th>Atividade</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const profile = u.qaProfile || u.developerProfile;
                const name    = profile?.name || '—';
                const detail  = u.qaProfile?.experienceLevel || u.developerProfile?.team || '—';
                return (
                  <tr key={u.id}>
                    <td>
                      <p style={{ fontWeight: 500 }}>{name}</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.email}</p>
                    </td>
                    <td><Badge role={u.role} /></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{detail}</td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--danger)' }}>{u._count?.createdBugs || 0} bugs</span>
                      {u.role === 'DEVELOPER' && (
                        <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
                          {u._count?.assignedBugs || 0} atrib.
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px',
                        borderRadius: 4, fontSize: '0.72rem',
                        background: u.isActive ? 'var(--success-dim)' : 'var(--danger-dim)',
                        color:      u.isActive ? 'var(--success)' : 'var(--danger)',
                      }}>
                        {u.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}>
                          Editar
                        </button>
                        {u.isActive && (
                          <button className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--warning)' }}
                            onClick={() => handleDeactivate(u)}>
                            Desativar
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)', borderColor: 'var(--danger-dim)' }}
                          onClick={() => handleDelete(u)}>
                          Deletar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { handleCreated(); setShowCreate(false); }}
        />
      )}
      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onUpdated={() => { handleUpdated(); setEditing(null); }}
        />
      )}
    </div>
  );
}