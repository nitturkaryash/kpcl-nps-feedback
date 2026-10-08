/**
 * POST /api/submit
 * Proxies to the box submit tunnel (GitHub CSV append) and optional Sheets webhook.
 */
const PROXY_URL =
  process.env.SUBMIT_PROXY_URL ||
  'http://bore.pub:61255/api/submit'
const SHEETS_URL = process.env.SHEETS_WEBHOOK_URL || ''
const REPO = process.env.GITHUB_REPO || 'nitturkaryash/kpcl-nps-feedback'
const BRANCH = process.env.GITHUB_BRANCH || 'main'
const CSV_PATH = 'data/responses.csv'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const QUESTIONNAIRE_TYPES = ['warranty', 'commissioning']

function str(value) {
  return value == null ? '' : String(value).trim()
}

function normalize(body) {
  const answers = Array.isArray(body.closedQuestionAnswers) ? body.closedQuestionAnswers : []
  const score = Number(body.npsScore)
  return {
    submittedAt: str(body.submittedAt) || new Date().toISOString(),
    srId: str(body.srId),
    requestType: str(body.requestType),
    questionnaireType: str(body.questionnaireType),
    questionnaireTitle: str(body.questionnaireTitle),
    closedQuestionAnswers: answers.map((item) => ({
      number: Number(item && item.number),
      question: str(item && item.question),
      answer: str(item && item.answer),
    })),
    remarks: str(body.remarks),
    npsScore: Number.isInteger(score) ? score : null,
    ratingBand: str(body.ratingBand),
  }
}

function validationError(n) {
  if (!n.srId) return 'srId required'
  if (!QUESTIONNAIRE_TYPES.includes(n.questionnaireType)) return 'questionnaireType must be warranty or commissioning'
  if (n.npsScore == null || n.npsScore < 1 || n.npsScore > 10) return 'npsScore must be 1 to 10'
  return null
}

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function rowFromNormalized(n) {
  return [
    n.submittedAt,
    n.srId,
    n.requestType,
    n.questionnaireType,
    n.questionnaireTitle,
    n.npsScore ?? '',
    n.ratingBand,
    n.remarks,
    JSON.stringify(n.closedQuestionAnswers),
    JSON.stringify(n),
  ]
    .map(csvEscape)
    .join(',')
}

async function appendGithubCsv(token, n) {
  const url = `https://api.github.com/repos/${REPO}/contents/${CSV_PATH}?ref=${BRANCH}`
  const getRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'kpcl-nps-feedback',
    },
  })
  const header =
    'submitted_at,sr_id,request_type,questionnaire_type,questionnaire_title,nps_score,rating_band,remarks,answers_json,raw_json\n'
  let current = header
  let sha
  if (getRes.ok) {
    const existing = await getRes.json()
    current = Buffer.from(existing.content, 'base64').toString('utf8')
    if (!current.endsWith('\n')) current += '\n'
    sha = existing.sha
  } else if (getRes.status !== 404) {
    throw new Error(`GitHub GET ${getRes.status}`)
  }
  current += rowFromNormalized(n) + '\n'
  const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${CSV_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'kpcl-nps-feedback',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `chore: append KPCL NPS response (${n.questionnaireType} SR ${n.srId})`,
      content: Buffer.from(current, 'utf8').toString('base64'),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  })
  if (!putRes.ok) throw new Error(`GitHub PUT ${putRes.status} ${await putRes.text()}`)
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const n = normalize(body)
    const invalid = validationError(n)
    if (invalid) return res.status(400).json({ ok: false, error: invalid })

    const result = { ok: true, github: false, sheets: false, proxy: false }

    // 1) Box tunnel proxy (appends GitHub CSV without needing Vercel secrets)
    try {
      const proxyRes = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true',
        },
        body: JSON.stringify(n),
      })
      const proxyJson = await proxyRes.json().catch(() => ({}))
      if (proxyRes.ok && proxyJson.ok !== false) {
        result.proxy = true
        result.github = Boolean(proxyJson.github)
      }
    } catch (err) {
      result.proxyError = String(err && err.message ? err.message : err)
    }

    // 2) Direct GitHub Contents API if token present
    const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    if (ghToken && !result.github) {
      await appendGithubCsv(ghToken, n)
      result.github = true
    }

    // 3) Sheets webhook if configured
    const sheetsUrl = SHEETS_URL
    if (sheetsUrl) {
      const sheetsRes = await fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(n),
        redirect: 'follow',
      })
      const sheetsText = await sheetsRes.text()
      if (!sheetsRes.ok) throw new Error(`Sheets webhook ${sheetsRes.status}: ${sheetsText}`)
      result.sheets = true
    }

    if (!result.github && !result.sheets) {
      return res.status(503).json({
        ok: false,
        error: 'No submit backend available (proxy/GitHub/Sheets)',
        detail: result,
      })
    }

    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) })
  }
}
