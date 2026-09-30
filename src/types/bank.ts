export interface BankConnection {
  id: string
  user_id: string
  pluggy_item_id: string
  institution_name: string
  institution_image_url: string | null
  status: 'UPDATING' | 'UPDATED' | 'LOGIN_ERROR' | 'OUTDATED' | 'ERROR'
  last_synced_at: string | null
  created_at: string
}

export interface BankAccount {
  id: string
  connection_id: string
  user_id: string
  pluggy_account_id: string
  name: string
  type: string | null
  balance: number
  currency_code: string
  updated_at: string
}

export interface BankTransaction {
  id: string
  account_id: string
  user_id: string
  pluggy_transaction_id: string
  description: string
  amount: number
  date: string
  category: string | null
  linked_debt_id: string | null
  created_at: string
}
