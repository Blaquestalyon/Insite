# Insite Integrative Wellness — Website

Static marketing site + appointment-request backend for **Dr. Janelle Thompson, DNAP, CRNA**.

When a visitor submits the appointment form, the backend does two things in parallel:

1. **Emails** `info@insiteintegrativewellness.com` via [Web3Forms](https://web3forms.com) (free, unlimited).
2. **Stores** the submission in an **Airtable** base for staff to review.

```
GitHub  ──push──▶  Railway  ──serves──▶  insiteintegrativewellness.com
                      │
                      ├──▶ Web3Forms  ──email──▶ info@insiteintegrativewellness.com
                      └──▶ Airtable   (Appointments table)
```

---

## 1. Local development

```bash
git clone https://github.com/<your-org>/insite-site.git
cd insite-site
cp .env.example .env       # fill in the four keys (see below)
npm install
npm run dev
# open http://localhost:3000
```

---

## 2. One-time setup of the three external services

### A. Web3Forms (email)

1. Visit **https://web3forms.com**.
2. Enter `info@insiteintegrativewellness.com` and click **Create Access Key**.
3. Open the verification email Web3Forms sends to that inbox and click the link. *(All future form submissions will be delivered to whichever inbox you verify here.)*
4. Copy the **Access Key**. You'll paste it as `WEB3FORMS_ACCESS_KEY` in Railway.

### B. Airtable (database)

1. Sign in at **https://airtable.com** and click **Create a base** → name it `Insite`.
2. Rename the default table to `Appointments` and add these columns *(names are case-sensitive — they must match exactly)*:

   | Column         | Type                              |
   | -------------- | --------------------------------- |
   | `Name`         | Single line text                  |
   | `Email`        | Email                             |
   | `Phone`        | Phone number                      |
   | `Service`      | Single line text                  |
   | `Message`      | Long text                         |
   | `SMS Consent`  | Checkbox                          |
   | `Submitted At` | Date  (turn on **Include time**)  |

3. Get your **Base ID**: go to **https://airtable.com/developers/web/api/introduction** → pick the `Insite` base → the ID starts with `app...`. Copy it.
4. Create a **Personal Access Token**: **https://airtable.com/create/tokens** → *Create token*.
   - **Scopes:** `data.records:write`
   - **Access:** Add the `Insite` base.
   - Copy the token (starts with `pat...`).

### C. Railway (hosting)

1. Sign in at **https://railway.app** with GitHub.
2. *(Skip this for now — finish step 3 below first, then come back.)*

---

## 3. Push the project to GitHub

```bash
cd insite-site
git init
git add .
git commit -m "Initial site"
gh repo create insite-site --private --source=. --remote=origin --push
# or, without the gh CLI: create the repo manually at github.com, then:
#   git remote add origin git@github.com:<your-org>/insite-site.git
#   git branch -M main
#   git push -u origin main
```

> The `.env` file is in `.gitignore` — your secrets will **not** be uploaded.

---

## 4. Deploy to Railway

1. **https://railway.app/new** → **Deploy from GitHub repo** → pick `insite-site`.
2. Railway auto-detects Node, runs `npm install`, then `npm start`. Wait for the green check.
3. Click the service → **Variables** → add:

   | Variable                | Value                                 |
   | ----------------------- | ------------------------------------- |
   | `WEB3FORMS_ACCESS_KEY`  | *(from step 2A)*                      |
   | `AIRTABLE_TOKEN`        | *(from step 2B — the `pat...` token)* |
   | `AIRTABLE_BASE_ID`      | *(from step 2B — the `app...` ID)*    |
   | `AIRTABLE_TABLE`        | `Appointments`                        |
   | `OFFICE_EMAIL`          | `info@insiteintegrativewellness.com`  |

4. Railway redeploys automatically. Click **Settings → Networking → Generate Domain** to get a temporary URL like `insite-site-production.up.railway.app`. Open it and submit a test form — confirm the email arrives and a row appears in Airtable.

---

## 5. Connect your custom domain `insiteintegrativewellness.com`

In Railway: **Settings → Networking → Custom Domain** → add both:

- `insiteintegrativewellness.com`
- `www.insiteintegrativewellness.com`

Railway will display the exact DNS records to create. They will look like:

| Type    | Name  | Value                                  |
| ------- | ----- | -------------------------------------- |
| `CNAME` | `www` | `<your-app>.up.railway.app`            |
| `A` or `ALIAS` | `@` (root) | *(value Railway shows you)*   |

Go to your domain registrar's DNS panel and add those records. Propagation usually completes within a few minutes; Railway will auto-issue a free SSL certificate once DNS resolves.

---

## 6. Future updates

Just push to `main`:

```bash
git add .
git commit -m "Update copy"
git push
```

Railway redeploys automatically. No other steps.

---

## Project layout

```
insite-site/
├── public/
│   ├── index.html          ← the website (unchanged design + form posts to /api/appointment)
│   └── insite-logo.jpeg
├── server.js               ← Express server: serves /public + handles POST /api/appointment
├── package.json
├── .env.example            ← template for required environment variables
├── .gitignore
└── README.md
```

## Security notes

- All secrets live in Railway environment variables — never in the repo.
- The submission endpoint is rate-limited to 5 requests / minute per IP.
- Input is length-capped and email is format-validated server-side.
- If either Web3Forms or Airtable fails, the other still runs — the office is never left without the lead.

## Troubleshooting

| Symptom                                         | Fix                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Form returns "Submission failed"                | Check Railway → **Deployments → View Logs** for the actual error from Web3Forms or Airtable.           |
| Email never arrives                             | Web3Forms only delivers to a **verified** address. Re-check that the verification email was clicked.   |
| Row never appears in Airtable                   | Column names are case-sensitive. Confirm they match the table in **Step 2B** exactly.                  |
| `429 Too many requests`                         | Per-IP rate limit. Wait 60 seconds — or raise `max` in `server.js` if you expect bursty traffic.       |
| Custom domain shows certificate warning         | DNS hasn't fully propagated. Wait 5–15 minutes and reload.                                             |
