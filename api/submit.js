/**
 * POST /api/submit
 * Proxies to the box submit tunnel (GitHub CSV append) and optional Sheets webhook.
 */
const PROXY_URL =
  process.env.SUBMIT_PROXY_URL ||
  'http://bore.pub:56061/api/submit'
const SHEETS_URL = process.env.SHEETS_WEBHOOK_URL || ''
const REPO = process.env.GITHUB_REPO || 'nitturkaryash/kpcl-nps-feedback'
const BRANCH = process.env.GITHUB_BRANCH || 'main'
const CSV_PATH = 'data/responses.csv'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function normalize(body) {
  const meta = body.meta || {}
  const answers =
    body.closedQuestionAnswers || body.closedQuestions || body.answers || []
  return {
    submittedAt: body.submittedAt || new Date().toISOString(),
    questionnaireType: body.questionnaireType || body.questionnaire_type || '',
    questionnaireTitle: body.questionnaireTitle || body.questionnaire_title || '',
    meta: {
      customerName: meta.customerName || '',
      phone: meta.phone || '',
      ticketId: meta.ticketId || '',
      date: meta.date || '',
    },
    closedQuestionAnswers: answers,
    remarks: body.remarks || '',
    npsScore: body.npsScore ?? body.nps_score ?? null,
    npsBand: body.npsBand || body.nps_band || '',
    experienceLabel: body.experienceLabel || body.experience_label || '',
  }
}

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
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
    'submitted_at,questionnaire_type,questionnaire_title,customer_name,phone,ticket_id,date,nps_score,nps_band,experience_label,remarks,answers_json,raw_json\n'
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
      message: `chore: append KPCL NPS response (${n.questionnaireType || 'unknown'})`,
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
    if (n.npsScore == null || !n.questionnaireType) {
      return res.status(400).json({ ok: false, error: 'npsScore and questionnaireType required' })
    }

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
