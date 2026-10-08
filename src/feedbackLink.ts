import {
  COMMISSIONING_PROBLEMS,
  OTHER_PROBLEM_PREFIX,
  type QuestionnaireType,
  TYPE_ALIASES,
  WARRANTY_PROBLEMS,
} from './feedbackConfig'

export interface FeedbackLink {
  srId: string
  /** The `type` value exactly as it appeared in the link (trimmed). */
  requestType: string
  questionnaireType: QuestionnaireType
}

export type FeedbackLinkResult =
  | { ok: true; link: FeedbackLink }
  | { ok: false; reason: 'missing-sr' | 'invalid-sr' | 'missing-type' | 'unknown-type' }

const SR_ID_PATTERN = /^[^\s<>"'`]{1,64}$/

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

const PROBLEM_LOOKUP = new Map<string, QuestionnaireType>([
  ...WARRANTY_PROBLEMS.map((name) => [normalize(name), 'warranty'] as const),
  ...COMMISSIONING_PROBLEMS.map((name) => [normalize(name), 'commissioning'] as const),
  ...Object.entries(TYPE_ALIASES).map(([alias, type]) => [normalize(alias), type] as const),
])

function isOtherProblem(normalized: string): boolean {
  const prefix = normalize(OTHER_PROBLEM_PREFIX)
  if (!normalized.startsWith(prefix)) return false
  const rest = normalized.slice(prefix.length)
  return rest === '' || /^[^a-z]/.test(rest)
}

export function resolveQuestionnaireType(requestType: string): QuestionnaireType | null {
  const normalized = normalize(requestType)
  const known = PROBLEM_LOOKUP.get(normalized)
  if (known) return known
  if (isOtherProblem(normalized)) return 'warranty'
  return null
}

export function parseFeedbackLink(search: string): FeedbackLinkResult {
  const params = new URLSearchParams(search)
  const srId = params.get('sr')?.trim() ?? ''
  const requestType = params.get('type')?.trim() ?? ''

  if (!srId) return { ok: false, reason: 'missing-sr' }
  if (!SR_ID_PATTERN.test(srId)) return { ok: false, reason: 'invalid-sr' }
  if (!requestType) return { ok: false, reason: 'missing-type' }

  const questionnaireType = resolveQuestionnaireType(requestType)
  if (!questionnaireType) return { ok: false, reason: 'unknown-type' }

  return { ok: true, link: { srId, requestType, questionnaireType } }
}
