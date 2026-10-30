import { FormEvent, useMemo, useState } from 'react'

type QuestionnaireType = 'warranty' | 'commissioning'
type BinaryAnswer = 'yes' | 'no'

interface ClosedQuestion {
  id: string
  text: string
}

interface Questionnaire {
  title: string
  closedQuestions: ClosedQuestion[]
  remarksQuestion: string
  npsQuestion: string
}

interface LinkContext {
  questionnaireType: QuestionnaireType
  serviceTypeFromLink: string
  serviceRequestId: string
  linkQueryParams: Record<string, string>
}

interface SubmissionPayload {
  submittedAt: string
  questionnaireType: QuestionnaireType
  questionnaireTitle: string
  serviceTypeFromLink: string
  serviceRequestId: string
  linkQueryParams: Record<string, string>
  closedQuestionAnswers: Array<ClosedQuestion & { answer: BinaryAnswer }>
  remarks: string
  npsScore: number
  npsBand: 'Detractor' | 'Passive' | 'Promoter'
  experienceLabel: string
}

const QUESTIONNAIRES: Record<QuestionnaireType, Questionnaire> = {
  warranty: {
    title: 'For Warranty and Post Warranty Services',
    closedQuestions: [
      {
        id: 'w1',
        text: 'Did you receive a call from the service engineer after filing the complaint?',
      },
      {
        id: 'w2',
        text: 'Did engineers visit on time and were cooperative with you?',
      },
      {
        id: 'w3',
        text: 'Was the problem solved and is the compressor in running condition?',
      },
      {
        id: 'w4',
        text: 'Are you satisfied with the service provided?',
      },
    ],
    remarksQuestion:
      'In your opinion, what can be done to further improve our services?',
    npsQuestion: 'How do you rate overall service support of KPCL?',
  },
  commissioning: {
    title: 'Commissioning call Questionnaire',
    closedQuestions: [
      {
        id: 'c1',
        text: 'Did you receive a call from the service engineer after filing the complaint?',
      },
      {
        id: 'c2',
        text: 'Did the engineers visit on time and were cooperative with you?',
      },
      {
        id: 'c3',
        text: 'Did Engineers explain to you about operations and maintenance of compressor?',
      },
      {
        id: 'c4',
        text: 'Did you sign the commissioning report?',
      },
      {
        id: 'c5',
        text: 'Is the compressor in running condition?',
      },
      {
        id: 'c6',
        text: 'Are you satisfied with the service provided?',
      },
    ],
    remarksQuestion:
      'In your opinion, what can be done to further improve our services?',
    npsQuestion: 'How do you rate overall service support of KPCL?',
  },
}

const NPS_GROUP_LABELS = {
  poor: 'Poor',
  neutral: 'Neutral',
  good: 'Good',
} as const

const NPS_COLOR_BY_SCORE: Record<number, string> = {
  1: '#B42318',
  2: '#D92D20',
  3: '#F04438',
  4: '#F97066',
  5: '#F79009',
  6: '#FDB022',
  7: '#FEC84B',
  8: '#FDCB6E',
  9: '#66C61C',
  10: '#39B975',
}

const NPS_EMOJI_BY_SCORE: Record<number, string> = {
  1: '😠',
  2: '🙁',
  3: '🙁',
  4: '😕',
  5: '😐',
  6: '😐',
  7: '🙂',
  8: '🙂',
  9: '😄',
  10: '😄',
}

const NPS_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

const SERVICE_TYPE_QUERY_KEYS = [
  'type',
  'serviceType',
  'service_type',
  'questionnaireType',
  'questionnaire_type',
] as const

const SERVICE_REQUEST_ID_QUERY_KEYS = [
  'serviceRequestId',
  'service_request_id',
  'requestId',
  'request_id',
  'ticketId',
  'ticket_id',
  'complaintId',
  'complaint_id',
  'srId',
  'sr_id',
] as const

function getNpsBand(score: number): 'Detractor' | 'Passive' | 'Promoter' {
  if (score <= 6) return 'Detractor'
  if (score <= 8) return 'Passive'
  return 'Promoter'
}

function getExperienceLabel(score: number): string {
  if (score <= 2) return 'Very Poor'
  if (score <= 4) return 'Poor'
  if (score <= 6) return 'Fair'
  if (score <= 8) return 'Good'
  return 'Excellent'
}

function normalizeServiceType(serviceType: string): QuestionnaireType | null {
  const normalized = serviceType.trim().toLowerCase()
  if (!normalized) return null

  if (normalized.includes('commission')) {
    return 'commissioning'
  }

  if (normalized.includes('warranty') || normalized.includes('post-warranty')) {
    return 'warranty'
  }

  return null
}

function parseLinkContext(): LinkContext {
  if (typeof window === 'undefined') {
    return {
      questionnaireType: 'warranty',
      serviceTypeFromLink: '',
      serviceRequestId: '',
      linkQueryParams: {},
    }
  }

  const query = new URLSearchParams(window.location.search)
  const linkQueryParams: Record<string, string> = {}

  query.forEach((value, key) => {
    linkQueryParams[key] = value
  })

  const serviceTypeFromLink =
    SERVICE_TYPE_QUERY_KEYS.map((key) => query.get(key) ?? '')
      .find((value) => Boolean(value.trim())) ?? ''

  const serviceRequestId =
    SERVICE_REQUEST_ID_QUERY_KEYS.map((key) => query.get(key) ?? '')
      .find((value) => Boolean(value.trim())) ?? ''

  return {
    questionnaireType: normalizeServiceType(serviceTypeFromLink) ?? 'warranty',
    serviceTypeFromLink,
    serviceRequestId,
    linkQueryParams,
  }
}

function downloadSubmission(payload: SubmissionPayload): void {
  const file = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const fileUrl = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = fileUrl
  anchor.download = `kpcl-feedback-${payload.questionnaireType}-${Date.now()}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(fileUrl)
}

export default function App() {
  const linkContext = useMemo(parseLinkContext, [])
  const [binaryAnswers, setBinaryAnswers] = useState<Record<string, BinaryAnswer>>(
    {},
  )
  const [remarks, setRemarks] = useState('')
  const [npsScore, setNpsScore] = useState<number | null>(null)
  const [submissionNote, setSubmissionNote] = useState<string | null>(null)
  const [submittedPayload, setSubmittedPayload] =
    useState<SubmissionPayload | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const currentQuestionnaire = QUESTIONNAIRES[linkContext.questionnaireType]

  const isFormValid = useMemo(() => {
    const allClosedAnswered = currentQuestionnaire.closedQuestions.every(
      (question) => Boolean(binaryAnswers[question.id]),
    )
    return allClosedAnswered && npsScore !== null
  }, [binaryAnswers, currentQuestionnaire.closedQuestions, npsScore])

  function setBinaryAnswer(questionId: string, value: BinaryAnswer): void {
    setBinaryAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }))
  }

  function resetForm(): void {
    setBinaryAnswers({})
    setRemarks('')
    setNpsScore(null)
    setSubmissionNote(null)
    setSubmitError(null)
    setSubmittedPayload(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!isFormValid || npsScore === null || isSubmitting) return

    const payload: SubmissionPayload = {
      submittedAt: new Date().toISOString(),
      questionnaireType: linkContext.questionnaireType,
      questionnaireTitle: currentQuestionnaire.title,
      serviceTypeFromLink: linkContext.serviceTypeFromLink,
      serviceRequestId: linkContext.serviceRequestId,
      linkQueryParams: linkContext.linkQueryParams,
      closedQuestionAnswers: currentQuestionnaire.closedQuestions.map(
        (question) => ({
          ...question,
          answer: binaryAnswers[question.id],
        }),
      ),
      remarks: remarks.trim(),
      npsScore,
      npsBand: getNpsBand(npsScore),
      experienceLabel: getExperienceLabel(npsScore),
    }

    setIsSubmitting(true)
    setSubmitError(null)
    console.log('KPCL feedback submission payload', payload)

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || `Submit failed (${response.status})`)
      }
      const parts = []
      if (result.sheets) parts.push('Google Sheet')
      if (result.github) parts.push('response log')
      setSubmissionNote(
        parts.length
          ? `Saved to ${parts.join(' and ')}.`
          : 'Response saved.',
      )
      setSubmittedPayload(payload)
    } catch (error) {
      console.error(error)
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Could not save your feedback. Please try again.',
      )
      downloadSubmission(payload)
      setSubmissionNote(
        'Could not reach the save API. Downloaded a local JSON fallback copy.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedPayload) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-4 sm:p-6">
        <section className="w-full rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg shadow-emerald-100/50 sm:p-8">
          <p className="text-sm font-semibold tracking-wide text-emerald-700">
            KPCL Service Feedback
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            Thank you for your feedback.
          </h1>
          <p className="mt-3 text-slate-600">
            Your response for {submittedPayload.questionnaireTitle} has been
            recorded.
          </p>
          {submittedPayload.serviceRequestId ? (
            <p className="mt-1 text-sm text-slate-500">
              Service request ID {submittedPayload.serviceRequestId}
            </p>
          ) : null}
          {submissionNote ? (
            <p className="mt-2 text-sm text-slate-500">{submissionNote}</p>
          ) : null}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Overall score</p>
            <p
              className="mt-2 inline-flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold text-white"
              style={{
                backgroundColor: NPS_COLOR_BY_SCORE[submittedPayload.npsScore],
              }}
            >
              {submittedPayload.npsScore}
            </p>
            <p className="mt-2 font-semibold text-slate-900">
              {submittedPayload.experienceLabel} ({submittedPayload.npsBand})
            </p>
          </div>
          <button
            type="button"
            className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            onClick={resetForm}
          >
            Submit another response
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/50 sm:p-8">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Kirloskar Pneumatic Company Limited
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            Service Feedback
          </h1>
          <p className="mt-4 text-xl font-semibold text-slate-600">
            Dear Customer
          </p>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
            We value your opinion and would love to know how we&apos;re doing.
            Please take a moment to share your feedback on how we can serve you
            better.
          </p>
        </header>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {currentQuestionnaire.closedQuestions.map((question, index) => {
            const answer = binaryAnswers[question.id]
            return (
              <article
                key={question.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {index + 1}. {question.text}
                </p>
                <div
                  role="radiogroup"
                  aria-label={question.text}
                  className="mt-3 grid grid-cols-2 gap-3"
                >
                  {(['yes', 'no'] as const).map((value) => {
                    const selected = answer === value
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${question.text} ${value}`}
                        onClick={() => setBinaryAnswer(question.id, value)}
                        className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                          selected
                            ? value === 'yes'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-slate-700 bg-slate-100 text-slate-900'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {value === 'yes' ? 'Yes' : 'No'}
                      </button>
                    )
                  })}
                </div>
              </article>
            )
          })}

          <article className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">
              {currentQuestionnaire.closedQuestions.length + 1}.{' '}
              {currentQuestionnaire.npsQuestion}
            </p>

            <div className="mt-6">
              <div className="grid grid-cols-10 gap-1 text-center text-sm font-semibold text-slate-700">
                {NPS_SCORES.map((score) => (
                  <span key={`nps-score-${score}`}>{score}</span>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-10 gap-1 text-center text-xs font-semibold text-slate-500">
                <span className="col-span-6">{NPS_GROUP_LABELS.poor}</span>
                <span className="col-span-2">{NPS_GROUP_LABELS.neutral}</span>
                <span className="col-span-2">{NPS_GROUP_LABELS.good}</span>
              </div>

              <div className="mt-2 grid grid-cols-10 gap-1 text-center text-xl">
                {NPS_SCORES.map((score) => (
                  <span key={`nps-emoji-${score}`}>{NPS_EMOJI_BY_SCORE[score]}</span>
                ))}
              </div>

              <div
                role="radiogroup"
                aria-label={currentQuestionnaire.npsQuestion}
                className="mt-2 grid grid-cols-10 gap-1"
              >
                {NPS_SCORES.map((score) => {
                  const selected = npsScore === score
                  const color = NPS_COLOR_BY_SCORE[score]
                  return (
                    <button
                      key={`nps-radio-${score}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Select score ${score}`}
                      onClick={() => setNpsScore(score)}
                      className="flex justify-center py-1"
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
                          selected ? 'border-transparent' : 'border-slate-300'
                        }`}
                        style={{
                          borderColor: selected ? color : undefined,
                          backgroundColor: selected ? `${color}22` : '#fff',
                        }}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            selected ? 'opacity-100' : 'opacity-0'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {npsScore ? (
              <p className="mt-3 text-sm font-semibold text-slate-900">
                Selected score {npsScore}. {getExperienceLabel(npsScore)}.{' '}
                {getNpsBand(npsScore)}.
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Please select an overall score from 1 to 10.
              </p>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4">
            <label
              className="block text-sm font-semibold text-slate-900"
              htmlFor="remarks"
            >
              {currentQuestionnaire.closedQuestions.length + 2}.{' '}
              {currentQuestionnaire.remarksQuestion}
            </label>
            <textarea
              id="remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Write your remarks or suggestions"
              className="mt-3 min-h-28 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-500 transition focus:ring-2"
            />
          </article>

          {submitError ? (
            <p className="mb-3 text-sm text-rose-600">{submitError}</p>
          ) : null}
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? 'Saving…' : 'Submit feedback'}
          </button>
        </form>
      </section>
    </main>
  )
}
