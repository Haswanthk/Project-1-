import React, { useState } from 'react'
import { ShieldCheck, AlertTriangle, ShieldX, Info } from 'lucide-react'
import type { ClaimVerificationResult } from '../../types/trust'

interface Props {
  claim: ClaimVerificationResult
}

export const ClaimBadge: React.FC<Props> = ({ claim }) => {
  const [showDetails, setShowDetails] = useState(false)

  const isVerified = claim.release_decision === 'VERIFIED'
  const isQualified = claim.release_decision === 'QUALIFIED'

  const badgeConfig = isVerified
    ? {
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />,
        label: 'CALCULATION VERIFIED',
      }
    : isQualified
    ? {
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
        label: 'QUALIFIED CLAIM',
      }
    : {
        bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
        icon: <ShieldX className="w-3.5 h-3.5 text-rose-400" />,
        label: 'WITHHELD CLAIM',
      }

  return (
    <div className="relative inline-block my-1 text-xs">
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-medium transition-all hover:opacity-90 ${badgeConfig.bg}`}
      >
        {badgeConfig.icon}
        <span>{badgeConfig.label}</span>
        <Info className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {showDetails && (
        <div className="absolute z-50 left-0 mt-2 w-80 p-3.5 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-slate-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5">
              {badgeConfig.icon}
              {claim.release_decision}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ID: {claim.claim_id}
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Calculation Status:</span>
              <span className="font-mono text-slate-200">{claim.calculation_status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Lineage Trust:</span>
              <span className="font-mono text-slate-200">{claim.lineage_trust_status}</span>
            </div>
            {claim.recomputed_value !== null && claim.recomputed_value !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-400">Platform Recomputed:</span>
                <span className="font-mono text-slate-200">{claim.recomputed_value}</span>
              </div>
            )}
            {claim.dataset_name && (
              <div className="flex justify-between">
                <span className="text-slate-400">Source Dataset:</span>
                <span className="text-slate-200 truncate max-w-[150px]">{claim.dataset_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Dataset Drift:</span>
              <span className="text-amber-400 font-mono">UNKNOWN</span>
            </div>
          </div>

          {claim.reasons && claim.reasons.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                Decision Audit Notes:
              </span>
              <ul className="mt-1 space-y-1 list-disc list-inside text-[10px] text-slate-300">
                {claim.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
