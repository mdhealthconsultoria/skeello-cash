import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldAlert, Users, ArrowDownCircle, ArrowUpCircle, Landmark, Search, ChevronRight, KeyRound } from 'lucide-react'
import { useAdmin } from '../hooks/useAdmin'
import { formatCurrency, formatDate } from '../lib/format'
import { formatCode } from '../lib/loans'
import type { AdminLoan, AdminUserDetail, AdminUserRow } from '../types/database'

type Tab = 'users' | 'loans'

export default function Admin() {
  const navigate = useNavigate()
  const { isAdmin, overview, users, loans, loading, error, getUserDetail } = useAdmin()
  const [tab, setTab] = useState<Tab>('users')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminUserRow | null>(null)
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const q = search.trim().toLowerCase()
  const filteredUsers = useMemo(
    () => users.filter((u) => !q || [u.name, u.email, u.username].some((v) => v?.toLowerCase().includes(q))),
    [users, q]
  )
  const filteredLoans = useMemo(
    () =>
      loans.filter(
        (l) =>
          !q ||
          [l.borrower_name, l.owner_name ?? '', l.share_code, ...l.funders.map((f) => f.funder_name)].some((v) =>
            v.toLowerCase().includes(q)
          )
      ),
    [loans, q]
  )

  async function openUser(u: AdminUserRow) {
    setSelected(u)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    const { detail: d, error: err } = await getUserDetail(u.id)
    setDetail(d)
    setDetailError(err)
    setDetailLoading(false)
  }

  if (!loading && !isAdmin) {
    return (
      <div className="flex flex-col items-center text-center py-20 px-6">
        <ShieldAlert size={32} className="text-ink-300 mb-3" />
        <h1 className="font-semibold text-ink-900 dark:text-ink-50 mb-1">Acesso restrito</h1>
        <p className="text-sm text-ink-400 mb-5">Essa área é só para o administrador do Skeello Cash.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary">
          Voltar
        </button>
      </div>
    )
  }

  // ===== detalhe de um perfil =====
  if (selected) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="p-2 -ml-2 text-ink-400" aria-label="Voltar">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50 truncate">{selected.name || selected.email}</h1>
            <p className="text-xs text-ink-400 truncate">
              @{selected.username} · {selected.email} · desde {formatDate(selected.created_at)}
            </p>
          </div>
        </div>

        {detailError && <p className="text-sm text-red-600">{detailError}</p>}
        {detailLoading && <div className="card h-48 animate-pulse" />}
        {detail && <UserDetail d={detail} />}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-ink-400">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Painel administrativo</h1>
          <p className="text-xs text-ink-400">Todos os perfis e empréstimos do Skeello Cash — visível só pra você</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card h-20 animate-pulse" />
            ))}
          </div>
          <div className="card h-64 animate-pulse" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={<Users size={16} />} label="Usuários" value={String(overview?.total_users ?? 0)} />
            <Stat
              icon={<ArrowDownCircle size={16} />}
              label="Total a receber"
              value={formatCurrency(overview?.total_receivable ?? 0)}
              tone="bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
            />
            <Stat
              icon={<ArrowUpCircle size={16} />}
              label="Total a pagar"
              value={formatCurrency(overview?.total_payable ?? 0)}
              tone="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
            />
          </div>

          <div className="flex gap-1 p-1 rounded-xl bg-ink-100 dark:bg-ink-800">
            {(
              [
                ['users', `Perfis (${users.length})`],
                ['loans', `Empréstimos (${loans.length})`],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium transition ${
                  tab === key
                    ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-50 shadow-sm'
                    : 'text-ink-500 dark:text-ink-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
              placeholder={tab === 'users' ? 'Buscar por nome, e-mail ou @usuário' : 'Buscar por devedor, dono ou código'}
            />
          </div>

          {tab === 'users' ? (
            <div className="space-y-2.5">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => openUser(u)}
                  className="w-full card p-4 text-left flex items-center gap-3 hover:shadow-md transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-900 dark:text-ink-50 truncate">{u.name || '(sem nome)'}</p>
                    <p className="text-xs text-ink-400 truncate">
                      @{u.username} · {u.email}
                    </p>
                    <p className="text-xs text-ink-400 mt-1">
                      {u.loans_count} empréstimo{u.loans_count === 1 ? '' : 's'} feito{u.loans_count === 1 ? '' : 's'} ·{' '}
                      {u.participations_count} participaç{u.participations_count === 1 ? 'ão' : 'ões'} · {u.people_count} pessoa
                      {u.people_count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <p className="text-brand-600 dark:text-brand-400">{formatCurrency(u.total_receivable)}</p>
                    <p className="text-red-600 dark:text-red-400">{formatCurrency(u.total_payable)}</p>
                  </div>
                  <ChevronRight size={16} className="text-ink-300 shrink-0" />
                </button>
              ))}
              {filteredUsers.length === 0 && <p className="text-sm text-ink-400">Ninguém encontrado.</p>}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLoans.map((l) => (
                <LoanBlock key={l.id} l={l} showOwner />
              ))}
              {filteredLoans.length === 0 && <p className="text-sm text-ink-400">Nenhum empréstimo encontrado.</p>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="card p-4">
      <span
        className={`inline-flex w-8 h-8 rounded-lg items-center justify-center mb-2 ${
          tone ?? 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300'
        }`}
      >
        {icon}
      </span>
      <p className="text-xs text-ink-400">{label}</p>
      <p className="text-lg font-semibold text-ink-900 dark:text-ink-50 truncate">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">{title}</h2>
      {children}
    </section>
  )
}

function UserDetail({ d }: { d: AdminUserDetail }) {
  const s = d.settings
  const yes = (v: boolean | undefined) => (v ? 'Ligado' : 'Desligado')
  return (
    <div className="space-y-6">
      <Section title="Configurações do perfil">
        <div className="card p-4 grid grid-cols-2 gap-y-2 text-sm">
          <Kv k="Tema" v={s?.theme ?? '-'} />
          <Kv k="Moeda" v={s?.currency ?? d.profile.currency} />
          <Kv k="Avisar vencimentos" v={yes(s?.notify_due)} />
          <Kv k="Avisar atrasos" v={yes(s?.notify_overdue)} />
          <Kv k="Resumos" v={yes(s?.notify_summary)} />
          <Kv k="Notificação no celular" v={d.push_enabled ? 'Ativada' : 'Não ativada'} />
        </div>
      </Section>

      <Section title={`Lembretes criados (${d.rules.length})`}>
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {d.rules.length === 0 && <p className="p-4 text-sm text-ink-400">Nenhum.</p>}
          {d.rules.map((r) => (
            <div key={r.id} className="px-4 py-2.5 text-sm flex justify-between">
              <span className="text-ink-900 dark:text-ink-50">
                {r.kind === 'receive' ? 'A receber' : 'A pagar'} · {r.days_before === 0 ? 'no dia' : `${r.days_before} dia(s) antes`}
              </span>
              <span className="text-ink-400">{r.enabled ? 'ligado' : 'desligado'}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Empréstimos que fez (${d.loans_owned.length})`}>
        {d.loans_owned.length === 0 && <p className="text-sm text-ink-400">Nenhum.</p>}
        {d.loans_owned.map((l) => (
          <LoanBlock key={l.id} l={l} />
        ))}
      </Section>

      <Section title={`Empréstimos em que participa (${d.loans_joined.length})`}>
        {d.loans_joined.length === 0 && <p className="text-sm text-ink-400">Nenhum.</p>}
        {d.loans_joined.map((l) => (
          <LoanBlock key={l.id} l={l} showOwner />
        ))}
      </Section>

      <Section title={`Dívidas (${d.debts.length})`}>
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {d.debts.length === 0 && <p className="p-4 text-sm text-ink-400">Nenhuma.</p>}
          {d.debts.map((x) => (
            <div key={x.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ink-900 dark:text-ink-50 truncate">
                  {x.type === 'receivable' ? 'Receber de' : 'Pagar a'} {x.person}
                </p>
                <p className="text-xs text-ink-400">
                  {x.due_date ? `vence ${formatDate(x.due_date)}` : 'sem vencimento'} · {x.status}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-medium text-ink-900 dark:text-ink-50">{formatCurrency(x.remaining)}</p>
                <p className="text-xs text-ink-400">de {formatCurrency(x.amount)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Pessoas (${d.people.length})`}>
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {d.people.length === 0 && <p className="p-4 text-sm text-ink-400">Nenhuma.</p>}
          {d.people.map((p) => (
            <div key={p.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-3">
              <span className="text-ink-900 dark:text-ink-50 truncate">{p.name}</span>
              <span className="text-xs text-ink-400 shrink-0">
                {p.following ? 'segue no app' : ''}
                {p.archived ? ' · arquivada' : ''}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="text-ink-400">{k}</span>
      <span className="text-ink-900 dark:text-ink-50 text-right">{v}</span>
    </>
  )
}

/** Empréstimo completo: o admin enxerga tudo (valor, juros, quem ganha quanto). */
function LoanBlock({ l, showOwner }: { l: AdminLoan; showOwner?: boolean }) {
  return (
    <div className="card p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900 dark:text-ink-50 flex items-center gap-1.5">
            <Landmark size={14} className="text-ink-400 shrink-0" />
            <span className="truncate">{l.borrower_name}</span>
          </p>
          <p className="text-xs text-ink-400">
            {showOwner ? `Dono: ${l.owner_name ?? '-'} · ` : ''}vence {formatDate(l.due_date)}
            {l.closed ? ' · encerrado' : ''}
          </p>
        </div>
        <p className="flex items-center gap-1 text-xs text-ink-500 shrink-0">
          <KeyRound size={12} /> {formatCode(l.share_code)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-y-1 text-sm">
        <Kv k="Emprestado" v={formatCurrency(l.principal)} />
        <Kv k={`Juros (${String(l.borrower_rate).replace('.', ',')}%)`} v={formatCurrency(l.total - l.principal)} />
        <Kv k="Total do devedor" v={formatCurrency(l.total)} />
        <Kv k="Já pago" v={formatCurrency(l.paid)} />
        <Kv k="Devedor no app" v={l.borrower_account ?? 'não entrou'} />
      </div>
      {l.funders.length > 0 && (
        <div className="border-t border-ink-100 dark:border-ink-800 pt-2 space-y-1">
          {l.funders.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-ink-500 dark:text-ink-400 truncate">
                {f.funder_name} ({f.account_name ?? 'não entrou'}) · {formatCurrency(f.amount)} a {String(f.rate).replace('.', ',')}%
              </span>
              <span className="text-ink-900 dark:text-ink-50 shrink-0">repassado {formatCurrency(f.paid)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
