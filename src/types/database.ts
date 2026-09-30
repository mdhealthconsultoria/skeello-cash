export type DebtType = 'receivable' | 'payable'
export type DebtStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
export type ShareStatus = 'none' | 'pending' | 'accepted' | 'declined'
export type Theme = 'light' | 'dark' | 'system'

export interface Profile {
  id: string
  name: string
  email: string
  avatar_url: string | null
  currency: string
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
  type: 'due_today' | 'due_soon' | 'overdue' | 'summary'
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
}

export interface PendingInvite extends Debt {
  inviter_name: string
  inviter_avatar_url: string | null
}
