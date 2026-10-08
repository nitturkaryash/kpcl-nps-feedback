import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import {
  type Question,
  QUESTIONNAIRES,
  type QuestionnaireType,
  RATING_BANDS,
  RATING_MAX,
  RATING_MIN,
  type RatingBand,
  type RatingFace,
  REMARKS_PLACEHOLDER,
} from './feedbackConfig'
import { type FeedbackLink, parseFeedbackLink } from './feedbackLink'

type BinaryAnswer = 'Yes' | 'No'

interface SubmissionPayload {
  submittedAt: string
  srId: string
  requestType: string
  questionnaireType: QuestionnaireType
  questionnaireTitle: string
  closedQuestionAnswers: Array<{ number: number; question: string; answer: BinaryAnswer }>
  remarks: string
  npsScore: number
  ratingBand: string
}

const RATING_SCORES = Array.from(
  { length: RATING_MAX - RATING_MIN + 1 },
  (_, index) => RATING_MIN + index,
)

function getRatingBand(score: number): RatingBand {
  const band = RATING_BANDS.find((item) => score >= item.from && score <= item.to)
  if (!band) throw new Error(`No rating band configured for score ${score}`)
  return band
}

function gridColumn(from: number, to: number): string {
  return `${from - RATING_MIN + 1} / ${to - RATING_MIN + 2}`
}

function PageHeader() {
  return (
    <header>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Kirloskar Pneumatic Company Limited
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
        Service Feedback
      </h1>
    </header>
  )
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-3 py-4 sm:p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-8">
        {children}
      </section>
    </main>
  )
}

function InvalidLinkScreen() {
  return (
    <PageShell>
      <PageHeader />
      <h2 className="mt-6 text-base font-semibold text-slate-900">
        This feedback link is not valid
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        The link may be incomplete or may have been copied incorrectly. Please
        open the feedback link exactly as it was shared with you for your
        service request, or contact KPCL service support for a new link.
      </p>
    </PageShell>
  )
}

function Face({ face, color, size }: { face: RatingFace; color: string; size: number }) {
  const mouth = (() => {
    switch (face) {
      case 'sad':
        return 'M8 17 Q12 13 16 17'
      case 'neutral':
        return 'M8.5 15.5 L15.5 15.5'
      case 'happy':
        return 'M8 14 Q12 18 16 14'
      default: {
        const unhandled: never = face
        throw new Error(`Unknown face ${String(unhandled)}`)
      }
    }
  })()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill={color} />
      <circle cx="8.5" cy="9.5" r="1.4" fill="#1f2937" />
      <circle cx="15.5" cy="9.5" r="1.4" fill="#1f2937" />
      <path d={mouth} stroke="#1f2937" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function RatingScale({
  value,
  onChange,
  label,
}: {
  value: number | null
  onChange: (score: number) => void
  label: string
}) {
  const columns = { gridTemplateColumns: `repeat(${RATING_SCORES.length}, minmax(0, 1fr))` }
  return (
    <div className="mt-4">
      <div className="grid" style={columns} aria-hidden="true">
        {RATING_SCORES.map((score) => (
          <span key={score} className="text-center text-xs font-semibold text-slate-700">
            {score}
          </span>
        ))}
      </div>
      <div className="mt-1 grid" style={columns} aria-hidden="true">
        {RATING_BANDS.map((band) => (
          <div
            key={band.label}
            className="mx-0.5 flex flex-col items-stretch"
            style={{ gridColumn: gridColumn(band.from, band.to) }}
          >
            <span
              className="h-1.5 rounded-b-sm border-x-2 border-b-2"
              style={{ borderColor: band.color }}
            />
            <span
              className="mt-0.5 text-center text-[11px] font-semibold leading-4"
              style={{ color: band.color }}
            >
              {band.label}
            </span>
          </div>
        ))}
      </div>
      <div role="radiogroup" aria-label={label} className="mt-2 grid" style={columns}>
        {RATING_SCORES.map((score) => {
          const band = getRatingBand(score)
          const selected = value === score
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${score}, ${band.label}`}
              onClick={() => onChange(score)}
              className="flex flex-col items-center gap-1.5 rounded-lg py-1 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <span
                className={`rounded-full transition ${selected ? 'scale-110' : value === null ? '' : 'opacity-60'}`}
                style={selected ? { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${band.color}` } : undefined}
              >
                <Face face={band.face} color={band.color} size={26} />
              </span>
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full border-2"
                style={{ borderColor: selected ? band.color : '#94a3b8' }}
              >
                {selected ? (
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: band.color }} />
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
      {value !== null ? (
        <p className="mt-3 text-sm font-semibold text-slate-900">
          Your rating: {value} ({getRatingBand(value).label})
        </p>
      ) : null}
    </div>
  )
}

function QuestionCard({
  question,
  missing,
  children,
}: {
  question: Question
  missing: boolean
  children: ReactNode
}) {
  return (
    <article
      id={`q-${question.number}`}
      className={`scroll-mt-4 rounded-2xl border bg-white p-4 ${missing ? 'border-rose-400' : 'border-slate-200'}`}
    >
      {question.type === 'remarks' ? (
        <label htmlFor="remarks" className="block text-sm font-semibold leading-6 text-slate-900">
          {question.number}. {question.text}
        </label>
      ) : (
        <p className="text-sm font-semibold leading-6 text-slate-900">
          {question.number}. {question.text}
        </p>
      )}
      {children}
      {missing ? (
        <p className="mt-2 text-xs font-medium text-rose-600">Please select an answer.</p>
      ) : null}
    </article>
  )
}

function FeedbackForm({ link }: { link: FeedbackLink }) {
  const questionnaire = QUESTIONNAIRES[link.questionnaireType]
  const [answers, setAnswers] = useState<Record<number, BinaryAnswer>>({})
  const [remarks, setRemarks] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [showMissing, setShowMissing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const missingNumbers = useMemo(
    () =>
      questionnaire.questions
        .filter((question) => {
          switch (question.type) {
            case 'yesno':
              return !answers[question.number]
            case 'rating':
              return rating === null
            case 'remarks':
              return false
            default: {
              const unhandled: never = question.type
              throw new Error(`Unknown question type ${String(unhandled)}`)
            }
          }
        })
        .map((question) => question.number),
    [answers, rating, questionnaire.questions],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (isSubmitting) return
    if (missingNumbers.length > 0 || rating === null) {
      setShowMissing(true)
      document
        .getElementById(`q-${missingNumbers[0]}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    const payload: SubmissionPayload = {
      submittedAt: new Date().toISOString(),
      srId: link.srId,
      requestType: link.requestType,
      questionnaireType: link.questionnaireType,
      questionnaireTitle: questionnaire.title,
      closedQuestionAnswers: questionnaire.questions
        .filter((question) => question.type === 'yesno')
        .map((question) => ({
          number: question.number,
          question: question.text,
          answer: answers[question.number],
        })),
      remarks: remarks.trim(),
      npsScore: rating,
      ratingBand: getRatingBand(rating).label,
    }

    setIsSubmitting(true)
    setSubmitError(null)
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
      setSubmitted(true)
      window.scrollTo({ top: 0 })
    } catch (error) {
      console.error(error)
      setSubmitError('We could not save your feedback. Please check your connection and tap Submit again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <PageShell>
        <PageHeader />
        <h2 className="mt-6 text-lg font-semibold text-slate-900">
          Thank you for your feedback.
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your response for service request {link.srId} has been recorded.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader />
      <p className="mt-4 text-base font-semibold text-slate-800">Dear Customer</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        We value your opinion and would love to know how we&rsquo;re doing.
        Please take a moment to share your feedback on how we can serve you
        better.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        {questionnaire.questions.map((question) => {
          const missing = showMissing && missingNumbers.includes(question.number)
          switch (question.type) {
            case 'yesno': {
              const answer = answers[question.number]
              return (
                <QuestionCard key={question.number} question={question} missing={missing}>
                  <div role="radiogroup" aria-label={question.text} className="mt-3 grid grid-cols-2 gap-3">
                    {(['Yes', 'No'] as const).map((value) => {
                      const selected = answer === value
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() =>
                            setAnswers((previous) => ({ ...previous, [question.number]: value }))
                          }
                          className={`h-11 rounded-xl border text-sm font-semibold transition ${
                            selected
                              ? value === 'Yes'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-rose-500 bg-rose-50 text-rose-700'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          {value}
                        </button>
                      )
                    })}
                  </div>
                </QuestionCard>
              )
            }
            case 'remarks':
              return (
                <QuestionCard key={question.number} question={question} missing={false}>
                  <textarea
                    id="remarks"
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    placeholder={REMARKS_PLACEHOLDER}
                    rows={4}
                    className="mt-3 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900 outline-none ring-slate-400 transition focus:ring-2 sm:text-sm"
                  />
                </QuestionCard>
              )
            case 'rating':
              return (
                <QuestionCard key={question.number} question={question} missing={missing}>
                  <RatingScale value={rating} onChange={setRating} label={question.text} />
                </QuestionCard>
              )
            default: {
              const unhandled: never = question.type
              throw new Error(`Unknown question type ${String(unhandled)}`)
            }
          }
        })}

        {submitError ? <p className="text-sm text-rose-600">{submitError}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? 'Submitting...' : 'Submit feedback'}
        </button>
      </form>
    </PageShell>
  )
}

export default function App() {
  const result = useMemo(() => parseFeedbackLink(window.location.search), [])
  if (!result.ok) return <InvalidLinkScreen />
  return <FeedbackForm link={result.link} />
}
