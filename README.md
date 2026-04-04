# SurakshID — KYC/AML Document Verification System

A full-stack KYC/AML document analyzer built on the MERN stack that automates identity verification for financial onboarding. Upload an identity document and SurakshID runs a complete verification pipeline — OCR extraction, AI classification, field validation, sanctions screening, and risk scoring — producing a regulatory-grade PDF audit report.

**Live Demo:** https://suraksh-id.vercel.app

---

## What Problem Does This Solve

Every bank, before onboarding a customer, is legally required to verify their identity under regulations like RBI (India), FinCEN (US), and FCA (UK). Banks receive thousands of identity documents daily — passports, Aadhaar cards, PAN cards, utility bills. Manually reviewing each one is slow, error-prone, and expensive.

SurakshID automates this entire process end-to-end.

---

## Features

### Document Upload & OCR
- Drag-and-drop or click-to-browse file upload
- Supports JPEG, PNG, TIFF, and PDF files (up to 10MB)
- PDF pages are converted to images via Poppler before OCR
- Tesseract OCR extracts raw text with automatic PSM fallback

### AI Document Classification
- Groq LLM (llama-3.3-70b-versatile) identifies the document type
- Supported types: Passport, National ID, PAN Card, Utility Bill, Company Registration Certificate, Bank Statement
- Returns confidence level and reasoning

### Structured Field Extraction
- Type-specific extraction prompts for each document type
- Passport: name, DOB, nationality, passport number, MRZ, expiry
- PAN Card: name, father's name, DOB, PAN number
- Utility Bill: name, address, bill date, service provider
- All extracted fields stored in MongoDB

### KYC Validation Engine (6 Rules)
| Rule | Check |
|------|-------|
| Document Expiry | Document must not be expired |
| Age Verification | Customer must be 18 or older |
| PAN Format | Must match regex `AAAAA9999A` |
| Address Proof Recency | Utility bill must be within last 90 days |
| Name Consistency | Names across fields must fuzzy-match via fuse.js |
| Completeness | All required fields must be present |

### AML Watchlist Screening
- Screens customer name against two sanctions databases
- **OFAC Consolidated Sanctions List** — US Treasury, covers all OFAC programs including SDN
- **UN Security Council Consolidated Sanctions List** — global UN sanctions
- Fuzzy name matching via fuse.js with configurable threshold
- Returns match score, list source, and sanction type

### Risk Scoring Engine
Weighted scoring system producing a 0–100 risk score:

| Triggered Rule | Points |
|----------------|--------|
| Sanctions match (OFAC/UN) | +50 |
| Document expired | +40 |
| Name mismatch | +30 |
| Missing required fields | +25 |
| Age below 18 | +20 |
| Address proof outdated | +15 |
| Invalid PAN format | +15 |

**Score Bands:**
- 0–20 → Low Risk — proceed with onboarding
- 21–50 → Medium Risk — flag for manual review
- 51+ → High Risk — escalate to compliance team

### PDF Audit Report
Regulatory-grade PDF generated with PDFKit containing:
- Verification summary with unique ID and timestamp
- Extracted customer details
- Validation results table (pass/fail per rule)
- AML screening outcome
- Risk score with full breakdown and recommendation

### Audit Log Dashboard
- Paginated table of all past verifications
- Filters: risk band, document type, pipeline status, date range, search by ID
- Aggregate statistics: total verifications, risk distribution, AML hits
- Click any row to view full verification result

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js + Vite |
| Styling | Single central `index.css` with CSS custom properties |
| HTTP Client | Axios |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| OCR | node-tesseract-ocr + Tesseract v5 |
| PDF Processing | pdf-poppler + Poppler |
| AI / LLM | Groq API (llama-3.3-70b-versatile) |
| Fuzzy Matching | fuse.js |
| Watchlist Parsing | csv-parse + xml2js |
| Scheduled Refresh | node-cron |
| PDF Generation | PDFKit |
| File Upload | Multer |

---

## Project Structure
surakshid/
├── backend/
│   ├── config/
│   │   └── db.js                    # MongoDB connection
│   ├── controllers/
│   │   ├── uploadController.js      # File upload + OCR
│   │   ├── classifyController.js    # Document classification
│   │   ├── extractController.js     # Field extraction
│   │   ├── validateController.js    # KYC validation rules
│   │   ├── screenController.js      # AML watchlist screening
│   │   ├── scoreController.js       # Risk scoring
│   │   ├── reportController.js      # PDF generation + download
│   │   └── auditController.js       # Audit log + stats
│   ├── middleware/
│   │   └── uploadMiddleware.js      # Multer configuration
│   ├── models/
│   │   └── Verification.js          # Mongoose schema
│   ├── routes/                      # Express route definitions
│   ├── services/
│   │   ├── watchlistService.js      # OFAC + UN list management
│   │   └── amlScreeningService.js   # Fuzzy name matching
│   ├── utils/
│   │   ├── ocrUtils.js              # Tesseract + Poppler OCR
│   │   ├── groqClient.js            # Groq API client
│   │   ├── extractionPrompts.js     # Type-specific LLM prompts
│   │   ├── validationRules.js       # 6 KYC validation rules
│   │   ├── riskScoring.js           # Weighted risk engine
│   │   └── pdfGenerator.js          # PDFKit report builder
│   ├── data/                        # Local watchlist files (dev only)
│   ├── uploads/                     # Uploaded documents
│   ├── reports/                     # Generated PDF reports
│   └── server.js                    # Entry point
└── frontend/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx
│   │   └── Loader.jsx
│   ├── pages/
│   │   ├── UploadPage.jsx        # Upload + pipeline runner
│   │   ├── ResultPage.jsx        # Verification results
│   │   └── AuditPage.jsx         # Audit log + stats
│   ├── services/
│   │   └── api.js                # Axios API client
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css                 # Central design system
└── index.html

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload document, run OCR |
| POST | `/api/classify` | Classify document type via LLM |
| POST | `/api/extract` | Extract structured fields via LLM |
| POST | `/api/validate` | Run 6 KYC validation rules |
| POST | `/api/screen` | AML watchlist screening |
| POST | `/api/score` | Compute risk score |
| POST | `/api/report/generate/:id` | Generate PDF audit report |
| GET | `/api/report/download/:id` | Download PDF report |
| GET | `/api/audit` | Paginated audit log with filters |
| GET | `/api/audit/stats` | Dashboard aggregate statistics |
| GET | `/api/audit/:id` | Single verification record |
| GET | `/api/score/:id` | Fetch existing risk score |
| GET | `/api/watchlist-status` | Watchlist load status |

---

## Local Development Setup

### Prerequisites
- Node.js v18+
- MongoDB Atlas account
- Groq API key — https://console.groq.com
- Tesseract OCR v5 — https://github.com/UB-Mannheim/tesseract/wiki
- Poppler — https://github.com/oschwartz10612/poppler-windows/releases

### Backend Setup
```bash
cd backend
npm install
```

Create `backend/.env`:
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
GROQ_API_KEY=your_groq_api_key

Download watchlist files and place in `backend/data/`:
- OFAC: https://ofac.treasury.gov/downloads/consolidated.csv → rename to `ofac_consolidated.csv.csv`
- UN: https://scsanctions.un.org/resources/xml/en/consolidated.xml → rename to `un_consolidated.xml.xml`
```bash
npm run dev
```

Server runs at `http://localhost:5000`

### Frontend Setup
```bash
cd frontend
npm install
```

Create `frontend/.env`:
VITE_API_URL=http://localhost:5000
```bash
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## Deployment

| Service | Platform |
|---------|----------|
| Backend | Render |
| Frontend | Vercel |
| Database | MongoDB Atlas |

### Render Environment Variables

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Atlas connection string |
| `GROQ_API_KEY` | Groq API key |
| `OFAC_CSV_URL` | Direct URL to hosted OFAC CSV |
| `UN_XML_URL` | Direct URL to hosted UN XML |

### Render Build Command
bash render-build.sh
Installs Tesseract OCR and Poppler on the Linux server automatically.

---

## Regulatory Context

This project mirrors real-world KYC/AML workflows used by financial institutions:

- **RBI** (Reserve Bank of India) — mandates identity verification before customer onboarding
- **FinCEN** (US) — requires screening against OFAC SDN list
- **FCA** (UK) — requires AML checks including PEP screening
- **OFAC Consolidated List** — US Treasury sanctions covering SDN, CAPTA, and other programs
- **UN Security Council List** — global sanctions imposed by the United Nations

---