export type ReleaseDecision = 'VERIFIED' | 'QUALIFIED' | 'WITHHELD'
export type CalculationStatus = 'MATCH' | 'MISMATCH' | 'NOT_RECOMPUTABLE' | 'UNAUTHORIZED' | 'SYNTHETIC'
export type LineageTrustStatus = 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN'

export interface ClaimVerificationResult {
  claim_id: string
  sentence: string
  target_dataset_id?: number
  column_name?: string
  operation: string
  claimed_value?: number
  recomputed_value?: number
  calculation_status: CalculationStatus
  lineage_trust_status: LineageTrustStatus
  release_decision: ReleaseDecision
  evidence_handle?: string
  reasons: string[]
  dataset_name?: string
  dataset_age_days?: number
  null_percentage?: number
  drift_status: string
  calibration_status: string
}

export interface CopilotChatResponse {
  feature: string
  status: string
  message: string
  provider_ready: boolean
  response?: string
  answer?: string
  provider?: string
  commentary?: string
  claims?: ClaimVerificationResult[]
  unverified_prose_warning?: boolean
}
