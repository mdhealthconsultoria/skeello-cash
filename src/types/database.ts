export type DebtType = 'receivable' | 'payable'
export type DebtStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
export type ShareStatus = 'none' | 'pending' | 'accepted' | 'declined'
export type Theme = 'light' | 'dark' | 'system'

export interface Profile {
  id: string
  name: string
  email: string
  username: string
  avatar_url: string | null
  currency: string
  is_admin: boolean
  created_at: string
}

export interface UserSettings {
  user_id: string
  theme: Theme
  currency: string
  date_format: string
  notify_due: boolean
  notify_overdue: boolean
  notify_summary: boolean
  demo_seeded: boolean
  /** % ao dia que já vem preenchido ao criar um empréstimo (0 = sem padrão) */
  default_daily_rate?: number
  /** juros de atraso ao dia (%) e multa única (%) padrão */
  default_late_rate?: number
  default_late_fee?: number
  updated_at: string
}

export interface Category {
  id: string
  user_id: string | null
  name: string
  icon: string
  is_default: boolean
  created_at: string
}

export interface Person {
  id: string
  user_id: string
  name: string
  nickname: string | null
  phone: string | null
  email: string | null
  notes: string | null
  photo_url: string | null
  archived: boolean
  linked_user_id: string | null
  created_at: string
  updated_at: string
}

export interface Debt {
  /** juros de atraso ao dia só desta dívida (null = usa o padrão) */
  late_daily_rate?: number | null
  id: string
  user_id: string
  person_id: string
  category_id: string | null
  type: DebtType
  amount: number
  description: string | null
  agreed_payment_method: string | null
  issue_date: string
  due_date: string | null
  installments: number
  status: DebtStatus
  notes: string | null
  archived: boolean
  counterparty_user_id: string | null
  share_status: ShareStatus
  mirror_debt_id: string | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  debt_id: string
  user_id: string
  amount: number
  payment_date: string
  method: string | null
  notes: string | null
  created_at: string
}

export interface DebtTotals {
  debt_id: string
  original_amount: number
  paid_amount: number
  remaining_amount: number
}

export interface Notification {
  id: string
  user_id: string
  debt_id: string | null
  type:
    | 'due_today'
    | 'due_soon'
    | 'overdue'
    | 'summary'
    | 'debt_invite'
    | 'debt_accepted'
    | 'contact_added'
    | 'loan_shared'
    | 'loan_due'
    | 'loan_joined'
    | 'reminder' | 'friend_request' | 'friend_accepted'
  message: string
  read: boolean
  created_at: string
}

export interface DebtWithRelations extends Debt {
  person: Person
  category: Category | null
  totals: DebtTotals
  payments?: Payment[]
}

export interface FoundUser {
  id: string
  name: string
  avatar_url: string | null
  username: string
}

export interface PendingInvite extends Debt {
  inviter_name: string
  inviter_avatar_url: string | null
}

export interface AdminOverview {
  total_users: number
  total_receivable: number
  total_payable: number
}

export interface AdminUserRow {
  id: string
  name: string
  email: string
  username: string
  created_at: string
  total_receivable: number
  total_payable: number
  loans_count: number
  loans_total: number
  participations_count: number
  people_count: number
}

export interface AdminLoan extends Loan {
  owner_name: string | null
  borrower_account: string | null
  total: number
  paid: number
  funders: (LoanFunder & { account_name: string | null; paid: number })[]
  payments: LoanPayment[]
}

export interface ReminderRule {
  id: string
  user_id: string
  kind: 'receive' | 'pay'
  days_before: number
  enabled: boolean
  created_at: string
}

export interface AdminUserDetail {
  profile: Profile
  settings: UserSettings | null
  push_enabled: boolean
  rules: ReminderRule[]
  people: { id: string; name: string; phone: string | null; email: string | null; archived: boolean; following: boolean }[]
  debts: {
    id: string
    type: DebtType
    person: string
    amount: number
    paid: number
    remaining: number
    due_date: string | null
    status: DebtStatus
    description: string | null
  }[]
  loans_owned: AdminLoan[]
  loans_joined: AdminLoan[]
}

// ===== Empréstimos a juros =====

export interface Loan {
  id: string
  owner_id: string
  borrower_name: string
  borrower_email: string | null
  borrower_user_id: string | null
  principal: number
  borrower_rate: number
  issue_date: string
  due_date: string
  notes: string | null
  closed: boolean
  share_code: string
  /** % ao dia combinado (null = juros fixo no prazo) */
  /** juros de atraso ao dia só deste empréstimo (null = usa o padrão) */
  late_daily_rate?: number | null
  daily_rate?: number | null
  /** % de um prazo só (o que se soma a cada renovação) */
  term_rate?: number | null
  created_at: string
  updated_at: string
}

export interface LoanFunder {
  id: string
  loan_id: string
  owner_id: string
  funder_name: string
  funder_email: string | null
  funder_user_id: string | null
  amount: number
  rate: number
  can_see_borrower: boolean
  can_see_payments: boolean
  can_see_chart?: boolean
  daily_rate?: number | null
  term_rate?: number | null
  created_at: string
}

export interface LoanPayment {
  id: string
  loan_id: string
  owner_id: string
  amount: number
  paid_at: string
  note: string | null
  created_at: string
}

export interface FunderPayment {
  id: string
  funder_id: string
  loan_id: string
  owner_id: string
  amount: number
  paid_at: string
  note: string | null
  created_at: string
}

export interface LoanRenewal {
  id: string
  loan_id: string
  owner_id: string
  interest_paid: number
  old_due: string
  new_due: string
  term_rate: number
  note: string | null
  created_at: string
}

export interface LoanFull extends Loan {
  renewals: LoanRenewal[]
  funders: LoanFunder[]
  payments: LoanPayment[]
  funder_payments: FunderPayment[]
}

export interface ParticipationPayment {
  id: string
  amount: number
  paid_at: string
  note: string | null
}

/** Empréstimo em que eu sou o tomador (visão de quem deve). */
export interface Borrowing {
  id: string
  due_date: string
  issue_date: string
  total: number
  paid: number
  owner_name: string | null
  closed: boolean
  payments: ParticipationPayment[]
}

/** Empréstimo em que eu sou co-fundador (visão de quem vai receber). */
export interface Funding {
  id: string
  due_date: string
  issue_date: string
  amount: number
  rate: number
  total: number
  paid: number
  owner_name: string | null
  closed: boolean
  borrower_name: string | null
  can_see_borrower: boolean
  can_see_chart?: boolean
  payments: ParticipationPayment[]
}
