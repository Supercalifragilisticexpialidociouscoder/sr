import type { DateRange, FinancialSummary } from '../../data/calc'
import type { ScopedRecords } from '../../data/selectors'
import type { Vehicle } from '../../data/types'

/** Every vehicle tab receives the same scoped slice, so they cannot disagree. */
export interface TabProps {
  vehicle: Vehicle
  records: ScopedRecords
  summary: FinancialSummary
  range: DateRange
  today: string
}
