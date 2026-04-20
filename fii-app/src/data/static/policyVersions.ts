export type PolicyRelease = {
  version: string;
  effectiveDate: string;
  label: string;
  summary: string;
};

export const POLICY_RELEASES: PolicyRelease[] = [
  {
    version: "2026-03-14",
    effectiveDate: "14/03/2026",
    label: "Versao 1",
    summary:
      "Primeira versao operacional com termos de uso, privacidade, aviso legal e registro de aceite no Supabase.",
  },
];

export const CURRENT_POLICY = POLICY_RELEASES[0];
export const CURRENT_POLICY_VERSION = CURRENT_POLICY.version;
export const CURRENT_POLICY_EFFECTIVE_DATE = CURRENT_POLICY.effectiveDate;
