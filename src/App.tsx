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

interface MetaFields {
  customerName: string
  phone: string
  ticketId: string
  date: string
}

interface SubmissionPayload {
  submittedAt: string
  questionnaireType: QuestionnaireType
  questionnaireTitle: string
  meta: MetaFields
  closedQuestionAnswers: Array<ClosedQuestion & { answer: BinaryAnswer }>
  remarks: string
  npsScore: number
  npsBand: 'Detractor' | 'Passive' | 'Promoter'
  experienceLabel: string
}

const QUESTIONNAIRES: Record<QuestionnaireType, Questionnaire> = {
  warranty: {
    title: 'Warranty and Post Warranty',
    closedQuestions: [
      {
        id: 'w1',
        text: 'Did you receive a call from the service engineer after filing a complaint?',
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
        text: 'Did the problem resolve on the first visit?',
      },
      {
        id: 'w5',
        text: 'Was your complaint understood by the service engineer, and did they attend with necessary tools and tackles?',
      },
      {
        id: 'w6',
        text: 'Did the service engineer attend site 2 hours post completion of job?',
      },
      {
        id: 'w7',
        text: 'Was the service engineer technically competent to solve complaints?',
      },
      {
        id: 'w8',
        text: 'Are you satisfied with the service provided?',
      },
    ],
    remarksQuestion: 'Any suggestions for service improvement?',
    npsQuestion: 'How do you rate overall service support of KPCL?',
  },
  commissioning: {
    title: 'Commissioning',
    closedQuestions: [
      {
        id: 'c1',
        text: 'Did you receive a call from the service engineer after filing a complaint?',
      },
      {
        id: 'c2',
        text: 'Did the engineers visit on time and were cooperative with you?',
      },
      {
        id: 'c3',
        text: 'Did engineers explain to you about operations and maintenance?',
      },
      {
        id: 'c4',
        text: 'Did you sign the commissioning report?',
      },
      {
        id: 'c5',
        text: 'Was the service engineer technically competent?',
      },
      {
        id: 'c6',
        text: 'Is compressor in running condition?',
      },
      {
        id: 'c7',
        text: 'Are you satisfied with the service provided?',
      },
    ],
    remarksQuestion: 'Any suggestions for service improvement?',
    npsQuestion: 'How do you rate overall service support of KPCL?',
  },
}

const NPS_COLOR_BY_SCORE: Record<number, string> = {
  1: '#B42318',
  2: '#D92D20',
  3: '#F04438',
  4: '#F97066',
  5: '#F79009',
  6: '#FDB022',
  7: '#66C61C',
  8: '#15B79E',
  9: '#039855',
  10: '#027A48',
}

const NPS_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

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

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10)
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
  const [questionnaireType, setQuestionnaireType] =
    useState<QuestionnaireType>('warranty')
  const [meta, setMeta] = useState<MetaFields>({
    customerName: '',
    phone: '',
    ticketId: '',
    date: getTodayDate(),
  })
  const [binaryAnswers, setBinaryAnswers] = useState<
    Record<QuestionnaireType, Record<string, BinaryAnswer>>
  >({
    warranty: {},
    commissioning: {},
  })
  const [remarksByType, setRemarksByType] = useState<
    Record<QuestionnaireType, string>
  >({
    warranty: '',
    commissioning: '',
  })
  const [npsByType, setNpsByType] = useState<
    Record<QuestionnaireType, number | null>
  >({
    warranty: null,
    commissioning: null,
  })
  const [submittedPayload, setSubmittedPayload] =
    useState<SubmissionPayload | null>(null)

  const currentQuestionnaire = QUESTIONNAIRES[questionnaireType]
  const currentAnswers = binaryAnswers[questionnaireType]
  const currentRemarks = remarksByType[questionnaireType]
  const currentNps = npsByType[questionnaireType]

  const isFormValid = useMemo(() => {
    const allClosedAnswered = currentQuestionnaire.closedQuestions.every(
      (question) => Boolean(currentAnswers[question.id]),
    )
    return allClosedAnswered && currentNps !== null
  }, [currentAnswers, currentNps, currentQuestionnaire.closedQuestions])

  function setBinaryAnswer(questionId: string, value: BinaryAnswer): void {
    setBinaryAnswers((previous) => ({
      ...previous,
      [questionnaireType]: {
        ...previous[questionnaireType],
        [questionId]: value,
      },
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!isFormValid || currentNps === null) return

    const payload: SubmissionPayload = {
      submittedAt: new Date().toISOString(),
      questionnaireType,
      questionnaireTitle: currentQuestionnaire.title,
      meta,
      closedQuestionAnswers: currentQuestionnaire.closedQuestions.map(
        (question) => ({
          ...question,
          answer: currentAnswers[question.id],
        }),
      ),
      remarks: currentRemarks.trim(),
      npsScore: currentNps,
      npsBand: getNpsBand(currentNps),
      experienceLabel: getExperienceLabel(currentNps),
    }

    console.log('KPCL feedback submission payload', payload)
    downloadSubmission(payload)
    setSubmittedPayload(payload)
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
            recorded locally.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Overall NPS score</p>
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
            onClick={() => setSubmittedPayload(null)}
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
          <p className="mt-2 text-sm text-slate-600">
            Please answer all questions for the selected service type. All
            questions are on this page.
          </p>
        </header>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900">
              Customer details
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Optional fields. You can submit without entering these details.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-700">
                <span>Customer name</span>
                <input
                  type="text"
                  value={meta.customerName}
                  onChange={(event) =>
                    setMeta((previous) => ({
                      ...previous,
                      customerName: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-500 transition focus:ring-2"
                  placeholder="Enter customer name"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span>Phone</span>
                <input
                  type="tel"
                  value={meta.phone}
                  onChange={(event) =>
                    setMeta((previous) => ({
                      ...previous,
                      phone: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-500 transition focus:ring-2"
                  placeholder="Enter phone number"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span>Ticket or Complaint ID</span>
                <input
                  type="text"
                  value={meta.ticketId}
                  onChange={(event) =>
                    setMeta((previous) => ({
                      ...previous,
                      ticketId: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-500 transition focus:ring-2"
                  placeholder="Enter ticket ID"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span>Date</span>
                <input
                  type="date"
                  value={meta.date}
                  onChange={(event) =>
                    setMeta((previous) => ({
                      ...previous,
                      date: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-500 transition focus:ring-2"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">
              Questionnaire type
            </h2>
            <div className="mt-3 inline-flex w-full rounded-2xl bg-slate-100 p-1">
              {(Object.keys(QUESTIONNAIRES) as QuestionnaireType[]).map(
                (type) => {
                  const isActive = type === questionnaireType
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`w-1/2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      onClick={() => setQuestionnaireType(type)}
                    >
                      {QUESTIONNAIRES[type].title}
                    </button>
                  )
                },
              )}
            </div>
          </section>

          <section className="space-y-4">
            {currentQuestionnaire.closedQuestions.map((question, index) => {
              const answer = currentAnswers[question.id]
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
                          className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                            selected
                              ? value === 'yes'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-rose-500 bg-rose-50 text-rose-700'
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
              <label
                className="block text-sm font-semibold text-slate-900"
                htmlFor="remarks"
              >
                {currentQuestionnaire.closedQuestions.length + 1}.{' '}
                {currentQuestionnaire.remarksQuestion}
              </label>
              <textarea
                id="remarks"
                value={currentRemarks}
                onChange={(event) =>
                  setRemarksByType((previous) => ({
                    ...previous,
                    [questionnaireType]: event.target.value,
                  }))
                }
                placeholder="Write your remarks or suggestions"
                className="mt-3 min-h-28 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-500 transition focus:ring-2"
              />
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">
                {currentQuestionnaire.closedQuestions.length + 2}.{' '}
                {currentQuestionnaire.npsQuestion}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                NPS bands. Detractor 1 to 6. Passive 7 to 8. Promoter 9 to 10.
                Color shows severity of the rating.
              </p>
              <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
                {NPS_SCORES.map((score) => {
                  const selected = currentNps === score
                  const color = NPS_COLOR_BY_SCORE[score]
                  return (
                    <button
                      key={score}
                      type="button"
                      aria-label={`Select NPS score ${score}`}
                      onClick={() =>
                        setNpsByType((previous) => ({
                          ...previous,
                          [questionnaireType]: score,
                        }))
                      }
                      className={`h-11 rounded-xl border text-sm font-bold transition ${
                        selected
                          ? 'scale-[1.02] border-transparent text-white shadow-md'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                      style={{
                        backgroundColor: selected ? color : undefined,
                        color: selected ? '#fff' : undefined,
                        borderColor: selected ? color : undefined,
                        boxShadow: selected
                          ? `0 8px 18px ${color}55`
                          : undefined,
                      }}
                    >
                      {score}
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 grid grid-cols-4 overflow-hidden rounded-xl text-[11px] font-semibold sm:text-xs">
                <div
                  className="px-2 py-2 text-center text-white"
                  style={{ background: '#D92D20' }}
                >
                  1 to 4 Severe
                </div>
                <div
                  className="px-2 py-2 text-center text-white"
                  style={{ background: '#F79009' }}
                >
                  5 to 6 Concern
                </div>
                <div
                  className="px-2 py-2 text-center text-slate-900"
                  style={{ background: '#66C61C' }}
                >
                  7 to 8 Good
                </div>
                <div
                  className="px-2 py-2 text-center text-white"
                  style={{ background: '#039855' }}
                >
                  9 to 10 Excellent
                </div>
              </div>
              {currentNps ? (
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  Selected score {currentNps}. {getExperienceLabel(currentNps)}.{' '}
                  {getNpsBand(currentNps)}.
                </p>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Please select an overall NPS score from 1 to 10.
                </p>
              )}
            </article>
          </section>

          <button
            type="submit"
            disabled={!isFormValid}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Submit feedback
          </button>
        </form>
      </section>
    </main>
  )
}
