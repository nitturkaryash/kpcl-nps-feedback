# KPCL Service Feedback Form

One-page NPS feedback form for Kirloskar Pneumatic Company Limited (KPCL).

## Configuration

Create a local env file from the example and set your Apps Script web app URL:

```bash
cp .env.example .env
```

`VITE_GOOGLE_SHEETS_WEBHOOK_URL` is optional:

- If set, the app POSTs submission JSON to your Google Apps Script webhook.
- If unset, the app downloads a local JSON file for each submission.
- If webhook delivery fails, the app automatically falls back to local JSON download.

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
- `questionnaireType`
- `questionnaireTitle`
- `meta` (`customerName`, `phone`, `ticketId`, `date`)
- `closedQuestionAnswers` (question list with `answer`)
- `remarks`
- `npsScore`
- `npsBand`
- `experienceLabel`

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
