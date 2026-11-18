import { useInterestDefaults } from './useInterestDefaults'

/** O % ao dia padrão que o usuário definiu em Configurações (0 = nenhum). */
export function useDefaultDailyRate() {
  return useInterestDefaults().dailyRate
}
