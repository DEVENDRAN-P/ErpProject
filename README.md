# ProductPilot AI — AI-Powered Product Intelligence for Industrial Commerce

## Problem Statement

Industrial product data is scattered across multiple sources — PDF datasheets, website catalogs, CSV files, and manual entries — with inconsistent formats, missing specifications, and conflicting values. Engineering teams spend significant time manually reconciling this data, leading to errors, inefficiencies, and unreliable product intelligence for commerce, ERP, and PIM systems.

## Solution

ProductPilot AI builds a reliable AI product-intelligence pipeline that:

1. **Ingests** product data from diverse sources (PDF, URL, image/OCR, CSV, manual entry)
2. **Extracts** structured specifications using document intelligence and rule-based AI
3. **Validates** data quality with multi-source conflict detection and missing-attribute identification
4. **Enriches** information with traceable evidence, confidence scores, and RAG-backed verification
5. **Calculates** dynamic product health scores from completeness, consistency, confidence, and source reliability
6. **Reviews** conflicts and missing data through a human-in-the-loop review center
7. **Tracks** product versions and catalog changes with full audit trails
8. **Exports** commerce-ready JSON and CSV formats for ERP/PIM integration

## Architecture

```text
PDF / URL / IMAGE / CSV
        ↓
DOCUMENT PROCESSING (PyMuPDF text extraction, table detection, OCR)
        ↓
AI EXTRACTION (rule-based + LLM fallback, with evidence and confidence)
        ↓
PRODUCTTWIN (structured digital profile for every attribute)
        ↓
PRODUCTTRUTH (multi-source comparison, automatic conflict detection)
        ↓
MISSING DATA DETECTION (never invents specifications)
        ↓
RAG ENRICHMENT (evidence-backed retrieval with TF-IDF vector index)
        ↓
EVIDENCE + CONFIDENCE (every value has source, evidence, confidence)
        ↓
PRODUCT HEALTH SCORE (dynamic 4-factor: completeness 40% + consistency 30% + confidence 20% + source reliability 10%)
        ↓
HUMAN REVIEW (APPROVE/REJECT/EDIT with audit logging)
        ↓
CATALOGPILOT (version diff detection, change tracking)
        ↓
PRODUCT VERSIONING (v1 → v2 → v3 with full change history)
        ↓
COMMERCE-READY JSON/CSV EXPORT
```

## Features

| Feature | Description |
|---------|-------------|
| **Multi-source Input** | PDF datasheets, Website URLs, Product images/OCR, CSV catalogs, Manual product data |
| **ProductTwin** | Structured digital profile with value, unit, confidence, status, source, page/section, evidence for every attribute |
| **ProductTruth** | Automatic conflict detection across sources with recommended values and reasoning |
| **Missing Data Detection** | Identifies required specifications that cannot be invented — displays "Insufficient evidence." |
| **RAG Enrichment** | Retrieval-augmented generation with TF-IDF vector index for evidence-backed results |
| **Evidence & Confidence** | Every AI-generated value displays source, evidence quote, and confidence score (0-100%) |
| **Product Health Score** | Dynamic calculation from completeness (40%), consistency (30%), confidence (20%), source reliability (10%) |
| **Human Review** | Review center for conflicts, missing data, low-confidence values with APPROVE/REJECT/EDIT actions and audit records |
| **CatalogPilot** | Detects product changes between versions with old/new value, source, evidence, confidence, timestamp |
| **Product Versioning** | Maintains V1/V2/V3 with changed attribute, old value, new value, source, evidence, timestamp, reviewer, approval status |
| **JSON/CSV Export** | Commerce-ready export with full attribute data including evidence and confidence |
| **Conflict Detection** | Automatic detection of contradictory values from different sources |
| **Support for Industrial Categories** | Not limited to motors — supports all industrial product categories |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 + React + TypeScript + Tailwind CSS |
| **Backend** | FastAPI + Python + SQLAlchemy |
| **PDF Extraction** | PyMuPDF (fitz) with table detection |
| **OCR** | PIL/Pillow with optional pytesseract |
| **AI/LLM** | OpenAI GPT-4o-mini or Google Gemini (fallback to rule-based extraction) |
| **RAG** | TF-IDF + Simple Vector Index (falls back from ChromaDB if available) |
| **Database** | SQLite for development, PostgreSQL for production |
| **Security** | JWT authentication, .env configuration, password hashing (passlib) |
| **Container** | Docker (backend Dockerfile, frontend Dockerfile) |

## Environment Variables

Create `.env` from `.env.example`:

```
OPENAI_API_KEY=              # OpenAI API key (optional — system falls back to rule-based)
GEMINI_API_KEY=              # Google Gemini API key (optional — system falls back to rule-based)
DATABASE_URL=sqlite:///./productpilot.db  # SQLite for local dev, PostgreSQL for production
JWT_SECRET_KEY=productpilot-dev-secret-key-2026
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
REDIS_URL=redis://localhost:6379/0  # only used by the optional Celery worker
```

## Setup & Run Instructions

### Prerequisites

- Python 3.11+
- Node.js 20+
- Git

### 1. Backend

From the project root (`unihack/`):

```bash
python -m pip install -r requirements.txt
# Start the server (tables, validation reference data and demo data are
# initialized automatically on startup)
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

To reseed the demo product or migrate an older database, run:

```bash
python -m backend.db.init_db
```

### 2. Frontend

From the project root (`unihack/`):

```bash
npm install
npm run dev
```

### 3. Access the Application

Open `http://localhost:3000` in your browser. Register an account, then sign in.

The application starts with a demo **Siemens 1LE1001 15kW industrial motor** already loaded, showcasing the full workflow: clean source (datasheet PDF), conflicting source (web catalog), and an incomplete source (missing total weight).

### Demo data

Demo/sample sources live in `demo_data/` and are clearly marked as demo data:

| File | Role |
|------|------|
| `Siemens_1LE1001_Datasheet.pdf` | Clean source — official datasheet (generated by `demo_data/generate_demo_pdf.py`, no external deps) |
| `siemens_1le1001_catalog.csv` | CSV catalog variant |
| `Siemens_1LE1001_WebCatalog.txt` | Conflicting source — legacy web listing (18.5 kW, 130 °C, IE2) |

Upload these in the Upload Center to demonstrate extraction, missing-data detection, and conflict detection.

### Running the tests

```bash
python -m pytest backend/tests -q
```

The PDF extraction test runs automatically when PyMuPDF (`fitz`) is installed and is skipped otherwise.

## Demo Workflow (3-5 minutes)

The following demo sequence demonstrates the complete ProductPilot AI pipeline:

### 1. Upload Motor PDF
- Navigate to the Upload Center
- Select a motor datasheet PDF file
- System extracts text using PyMuPDF

### 2. Extract Product Data
- Extraction results display automatically
- Pages extracted, tables detected, text content shown
- ProductTwin attributes generated from extracted text

### 3. Generate ProductTwin
- View structured digital profile for the industrial motor
- Each attribute displays: value, unit, confidence, status, source, page, evidence
- Example: `Voltage: 415 V, Confidence: 96%, Status: VERIFIED, Source: motor_datasheet.pdf, Page: 3`

### 4. Display Evidence and Confidence
- ProductTwin tab shows all 8 required motor attributes
- Confidence bars visualize extraction confidence
- Evidence quotes trace each value to its source
- Status indicators: VERIFIED, UNVERIFIED, CONFLICT, MISSING, LOW_CONFIDENCE, AI_ENRICHED

### 5. Detect Missing Attributes
- System identifies `total_weight` as missing (no evidence found)
- Displays: "Insufficient evidence." — never invents technical specifications
- Completeness score: 87.5% (7 of 8 required attributes present)

### 6. Add Another Source
- Upload a second PDF or provide a website URL
- System extracts and compares data from both sources

### 7. Detect a Conflict
- If two sources provide different values for the same attribute
- Automatic conflict detection (e.g., max_temperature: 155°C datasheet vs 130°C web catalog)
- Display: values, sources, evidence, confidence, source reliability
- Recommended value with reasoning

### 8. Retrieve Supporting Evidence Using RAG
- Use the RAG Verification tab
- Ask questions like "What is the rated voltage and efficiency class?"
- System retrieves evidence from indexed documents with confidence scores
- Returns "Insufficient evidence." if no supporting data exists

### 9. Calculate Health Score
- Dynamic health score computed from 4 factors:
  - Completeness: 87.5% (7/8 attributes present)
  - Consistency: 80% (1 open conflict × 25% penalty)
  - Confidence: 82.8% average
  - Source Reliability: % from PDF/datasheet sources
- Overall score: e.g., 83/100 = "Commerce-Ready"
- Breakdown displayed: completeness × 40% + consistency × 30% + confidence × 20% + source reliability × 10%

### 10. Send Conflict to Human Review
- Conflict item added to Human Review queue
- Reviewer can APPROVE, REJECT, or EDIT the conflicting value
- Audit record created for the action

### 11. Approve/Edit/Reject
- Human reviewer reviews the conflict item
- APPROVE: marks as verified, updates confidence to 100%
- REJECT: marks as missing, clears value
- EDIT: allows entering corrected value with evidence
- Health score recalculated dynamically

### 12. Detect a Catalog Change
- Version tracking detects attribute changes between versions
- Example: Operating Temperature changes from 70°C to 80°C
- Shows: old value, new value, source, evidence, confidence, timestamp

### 13. Create New Product Version
- New version (v2) created with change entry
- Tracks: changed attribute, old value, new value, source, evidence, timestamp
- Version comparison available for review

### 14. Export JSON/CSV
- Click Export → JSON for commerce-ready structured specification
- Click Export → CSV for ERP/PIM system import
- Export includes: all attributes with value, unit, confidence, status, source, page, evidence
- Health score included in export

## UniHack Expected Outcomes

The demonstration must clearly show the transformation from scattered industrial data to commerce-ready product intelligence:

### SCATTERED INDUSTRIAL DATA
- Multiple sources (PDF datasheets, web catalogs, manual entries)
- Inconsistent formats, missing values, conflicting specifications
- Engineering time wasted manually reconciling data

### AI UNDERSTANDING
- PDF extraction and text parsing
- Rule-based attribute extraction with evidence
- Confidence scoring and status classification
- Multi-source data integration

### PRODUCTTWIN
- Structured digital profile for the industrial motor
- All 8 attributes with value, unit, confidence, status, source, page, evidence
- Support for industrial product categories beyond motors

### PRODUCTTRUTH
- Multi-source comparison displayed
- Automatic conflict detection and resolution
- Recommended values with reasoning
- Never silently overwrites conflicting information

### RAG
- Real RAG pipeline: documents → extraction → chunking → embeddings → vector database → retrieval → LLM → evidence-backed result
- Evidence displayed with source and confidence
- "Insufficient evidence." clearly indicated when no data exists

### EVIDENCE + CONFIDENCE
- Every important AI-generated value has: Source, Evidence, Confidence
- Three states clearly distinguished: EXTRACTED, VERIFIED, AI_ENRICHED
- "Insufficient evidence." when no evidence can be found

### HEALTH SCORE
- Dynamically calculated from completeness, consistency, confidence, source reliability
- All component scores displayed alongside overall score
- Recalculated after every Human Review action

### HUMAN REVIEW
- Review center for conflicts, missing critical data, low-confidence values
- APPROVE/REJECT/EDIT actions actually update product data
- Audit records created for each action with reviewer, action, timestamp

### CATALOGPILOT
- Product changes between versions detected and displayed
- Old value → New value with source, evidence, confidence, timestamp
- Changes sent to Human Review for approval

### VERSIONING
- V1 (initial ingest) → V2 (after review/edits) → V3 (subsequent changes)
- Track: changed attribute, old value, new value, source, evidence, timestamp, reviewer, approval status
- Version comparison functionality

### COMMERCE-READY PRODUCT DATA
- JSON export with full attribute structure
- CSV export formatted for ERP/PIM import
- All data traceable to source with evidence and confidence

## License

This project is developed for the UniHack challenge 2026.