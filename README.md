# KPCL Service Feedback Form

One-page NPS feedback form for Kirloskar Pneumatic Company Limited (KPCL).

## Feedback links

Each link is specific to one service request (SR):

```
https://kpcl-nps-feedback.vercel.app/?sr=<SR ID>&type=<request type>
```

- `sr`: the SR / ticket ID (required, no spaces, up to 64 characters).
- `type`: `warranty`, `commissioning`, or a problem name from the
  "Problems Dropdown" list (URL-encoded, case-insensitive), for example
  `type=KRMS%20Commissioning`.
  - `Commissioning of Compressor`, `Compressor Recommissioning` and
    `KRMS Commissioning` show the commissioning questions.
  - Every other problem (including `Other ...`) shows the warranty questions.

A link with a missing or unrecognised `sr` / `type` shows an "invalid link"
message instead of the form.

Questions, rating band words/ranges, and the problem list live in
`src/feedbackConfig.ts`.

## Configuration

Create a local env file from the example and set your Apps Script web app URL:

```bash
cp .env.example .env
```

The form POSTs each submission to `/api/submit` (`api/submit.js`), which
forwards it to the submit proxy (`SUBMIT_PROXY_URL`), the GitHub CSV backup
(`GITHUB_TOKEN`), and the Google Sheets webhook (`SHEETS_WEBHOOK_URL`).
If saving fails, the customer sees an error and can tap Submit again; their
answers are kept.

## Run

```bash
npm i
npm run dev
```

## Build

```bash
npm run build
```

Deploy the `dist/` folder to Vercel or any static host for a shareable link.

## Google Sheets webhook flow

This project is designed to send each submission payload to a Google Apps Script
web app, which writes rows to a Google Sheet.

- Spreadsheet (existing):  
  https://docs.google.com/spreadsheets/d/1tY_dneeiuyLryz3it9Hh7ZaodOMR720L4O65rQXlYmw/edit
- Apps Script receives JSON in `doPost(e)` and appends to `Responses`.

### Expected payload shape

The payload posted to the webhook matches the same JSON shape used for local
download fallback:

- `submittedAt`
- `srId` (from the link)
- `requestType` (the `type` value from the link)
- `questionnaireType` (`warranty` or `commissioning`)
- `questionnaireTitle`
- `closedQuestionAnswers` (`number`, `question`, `answer` of `Yes`/`No`)
- `remarks`
- `npsScore` (1 to 10)
- `ratingBand` (band word, e.g. `Poor`, `Neutral`, `Good`)

The GitHub CSV backup (`data/responses.csv`) uses the columns
`submitted_at,sr_id,request_type,questionnaire_type,questionnaire_title,nps_score,rating_band,remarks,answers_json,raw_json`.
Rows from the earlier form version are in `data/responses-legacy.csv`.

### Apps Script deployment steps

1. Open your Apps Script project linked to the spreadsheet.
2. Ensure `doPost(e)` parses `e.postData.contents` and writes to the
   `Responses` sheet.
3. Deploy as **Web app**:
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Copy the Web App URL and set it as `VITE_GOOGLE_SHEETS_WEBHOOK_URL`.
5. Redeploy/restart your Vite app so the env var is picked up.

### Request format used by the app

The frontend sends:

- `method: POST`
- `redirect: follow`
- `Content-Type: text/plain;charset=utf-8`
- `body: JSON.stringify(payload)`

Using `text/plain` avoids Apps Script CORS preflight issues in many setups.
