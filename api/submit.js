/**
 * POST /api/submit — append KPCL NPS feedback to GitHub CSV (+ optional Sheets webhook).
 */
const REPO = process.env.GITHUB_REPO || 'nitturkaryash/kpcl-nps-feedback'
const BRANCH = process.env.GITHUB_BRANCH || 'main'
const CSV_PATH = 'data/responses.csv'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Normalize either App.tsx shape or Apps Script shape */
function normalize(body) {
  const meta = body.meta || {}
  const answers =
    body.closedQuestionAnswers ||
    body.closedQuestions ||
    body.answers ||
    []
  return {
    submittedAt: body.submittedAt || body.submitted_at || new Date().toISOString(),
    questionnaireType: body.questionnaireType || body.questionnaire_type || '',
    questionnaireTitle: body.questionnaireTitle || body.questionnaire_title || '',
    meta: {
      customerName: meta.customerName || meta.customer_name || '',
      phone: meta.phone || '',
      ticketId: meta.ticketId || meta.ticket_id || '',
      date: meta.date || '',
    },
    answers,
    remarks: body.remarks || '',
    npsScore: body.npsScore ?? body.nps_score ?? null,
    npsBand: body.npsBand || body.nps_band || '',
    experienceLabel: body.experienceLabel || body.experience_label || '',
    raw: body,
  }
}

function rowFromNormalized(n) {
  return [
    n.submittedAt,
    n.questionnaireType,
    n.questionnaireTitle,
    n.meta.customerName,
    n.meta.phone,
    n.meta.ticketId,
    n.meta.date,
    n.npsScore ?? '',
    n.npsBand,
    n.experienceLabel,
    n.remarks,
    JSON.stringify(n.answers),
    JSON.stringify(n.raw),
  ]
    .map(csvEscape)
    .join(',')
}

async function githubGetFile(token, path) {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'kpcl-nps-feedback',
    },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function githubPutFile(token, path, content, sha, message) {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'kpcl-nps-feedback',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  })
  if (!res.ok) throw new Error(`GitHub PUT ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function appendGithubCsv(token, n) {
  const existing = await githubGetFile(token, CSV_PATH)
  const header =
    'submitted_at,questionnaire_type,questionnaire_title,customer_name,phone,ticket_id,date,nps_score,nps_band,experience_label,remarks,answers_json,raw_json\n'
  let current = header
  let sha
  if (existing && existing.content) {
    current = Buffer.from(existing.content, 'base64').toString('utf8')
    if (!current.endsWith('\n')) current += '\n'
    sha = existing.sha
  }
  current += rowFromNormalized(n) + '\n'
  await githubPutFile(
    token,
    CSV_PATH,
    current,
    sha,
    `chore: append KPCL NPS response (${n.questionnaireType || 'unknown'})`,
  )
}

async function forwardSheetsWebhook(url, n) {
  // Shape expected by /workspace/kpcl-sheets/Code.gs
  const sheetsBody = {
    submittedAt: n.submittedAt,
    questionnaireType: n.questionnaireType,
    questionnaireTitle: n.questionnaireTitle,
    meta: n.meta,
    closedQuestionAnswers: n.answers,
    remarks: n.remarks,
    npsScore: n.npsScore,
    npsBand: n.npsBand,
    experienceLabel: n.experienceLabel,
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sheetsBody),
    redirect: 'follow',
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  if (!res.ok) throw new Error(`Sheets webhook ${res.status}: ${text}`)
  return json
}

module.exports = async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const n = normalize(body)
    if (n.npsScore == null || !n.questionnaireType) {
      return res.status(400).json({ ok: false, error: 'npsScore and questionnaireType required' })
    }

    const result = { ok: true, github: false, sheets: false }

    const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    if (ghToken) {
      await appendGithubCsv(ghToken, n)
      result.github = true
    }

    const sheetsUrl = process.env.SHEETS_WEBHOOK_URL || process.env.GOOGLE_SHEETS_WEBHOOK_URL
    if (sheetsUrl) {
      result.sheetsResult = await forwardSheetsWebhook(sheetsUrl, n)
      result.sheets = true
    }

    if (!result.github && !result.sheets) {
      return res.status(503).json({
        ok: false,
        error: 'No GITHUB_TOKEN or SHEETS_WEBHOOK_URL configured on Vercel',
      })
    }

    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) })
  }
}
