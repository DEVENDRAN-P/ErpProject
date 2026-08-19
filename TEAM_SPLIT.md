# ProductPilot AI — 4-Team Feature Split

## Current State
- Backend: FastAPI + SQLAlchemy (SQLite) + Firebase Auth
- Frontend: Next.js 14 + Tailwind CSS + Firebase Auth
- 60 backend modules, 19 API routes, 7 dashboard tabs
- AI Pipeline: Document parsing → Attribute extraction → Validation → Health Score → RAG

---

## Team 1: Knowledge Graph & Data Lineage (Backend + Frontend)

**Focus:** Build the Knowledge Graph agent and visual product relationship map.

### Backend Tasks
- [ ] Implement `knowledge_graph_agent.py` — extract entity relationships from product data
- [ ] New API endpoint: `GET /api/products/{id}/knowledge-graph`
- [ ] New model: `ProductRelationship` (product-to-product, product-to-manufacturer, attribute-to-standard)
- [ ] Graph data structure: nodes (products, manufacturers, standards, attributes) + edges (relates_to, compliant_with, manufactured_by)
- [ ] Query endpoint: `POST /api/knowledge-graph/query` — find related products, standards, manufacturers

### Frontend Tasks
- [ ] New tab in EnterpriseDashboard: "Knowledge Graph"
- [ ] Interactive graph visualization (use `react-force-graph-2d` or `@react-sigma/core`)
- [ ] Node click → show product details sidebar
- [ ] Edge labels showing relationship type
- [ ] Filter by node type (products, manufacturers, standards)

### Deliverables
- Working knowledge graph that builds from ingested products
- Interactive visualization with zoom, pan, click
- API endpoints documented in OpenAPI

---

## Team 2: Explainability & AI Transparency (Backend + Frontend)

**Focus:** Make every AI decision transparent and auditable.

### Backend Tasks
- [ ] Implement `explainability_agent.py` — for each attribute, explain WHY the AI chose that value
- [ ] New API endpoint: `GET /api/products/{id}/explainability`
- [ ] For each attribute return: source document, extraction method, confidence breakdown, alternative candidates considered
- [ ] New model: `ExplanationLog` — stores AI reasoning chain for audit
- [ ] `POST /api/products/{id}/explainability/{attr_key}` — detailed explanation for one attribute

### Frontend Tasks
- [ ] New tab in EnterpriseDashboard: "Explainability"
- [ ] Attribute-level explanation cards showing:
  - Source document + page number
  - Extraction method (rule-based vs LLM)
  - Confidence breakdown (unit match, context match, plausibility)
  - Alternative values considered
  - Evidence quote with highlight
- [ ] "Why this value?" tooltip on each ProductTwin attribute
- [ ] AI decision audit trail timeline

### Deliverables
- Every attribute has a full explanation chain
- Visual explanation cards with expandable details
- Audit trail for compliance

---

## Team 3: Batch Operations & Data Quality Reports (Backend + Frontend)

**Focus:** Bulk import/export, quality dashboards, and compliance reporting.

### Backend Tasks
- [ ] Batch import endpoint: `POST /api/products/batch-import` (accept CSV with multiple products)
- [ ] Batch export: `GET /api/products/batch-export` (all products as CSV/JSON)
- [ ] New endpoint: `GET /api/reports/data-quality` — aggregate quality metrics across all products
- [ ] New endpoint: `GET /api/reports/compliance` — compliance status by category
- [ ] New endpoint: `GET /api/reports/audit-trail` — all review actions with timestamps
- [ ] Implement `export_agent.py` — rich export with metadata, timestamps, provenance

### Frontend Tasks
- [ ] New page: `/reports` — Data Quality Dashboard
  - Overall quality score trend (line chart)
  - Completeness heatmap by product category
  - Conflict resolution rate (pie chart)
  - Missing specs breakdown by attribute
- [ ] New page: `/batch` — Batch Import/Export
  - CSV upload with preview table
  - Import progress bar with error reporting
  - Bulk export with filter options
- [ ] Compliance report view with exportable PDF summary
- [ ] Activity/audit trail timeline view

### Deliverables
- Batch import/export working end-to-end
- Data quality dashboard with charts
- Compliance reports exportable as PDF

---

## Team 4: Real-time Features & Notifications (Backend + Frontend)

**Focus:** WebSocket updates, notifications, and collaboration features.

### Backend Tasks
- [ ] WebSocket endpoint: `ws://localhost:8000/ws/notifications` — real-time updates
- [ ] New model: `Notification` (user_id, type, message, read, created_at)
- [ ] New API: `GET /api/notifications` — list user notifications
- [ ] New API: `PATCH /api/notifications/{id}/read` — mark as read
- [ ] New API: `POST /api/notifications/mark-all-read`
- [ ] Event triggers: on product created, conflict detected, review completed
- [ ] Implement `human_review_agent.py` — auto-assign review items based on expertise

### Frontend Tasks
- [ ] Notification bell with unread count badge (enhance existing)
- [ ] Notification dropdown panel with:
  - Real-time updates via WebSocket
  - Mark as read/unread
  - Click to navigate to relevant product
  - Filter by type (conflict, review, system)
- [ ] Toast notifications for real-time events
- [ ] User presence indicators (who's reviewing what)
- [ ] Activity feed on dashboard showing recent team actions

### Deliverables
- Real-time notifications working via WebSocket
- Notification center with full UI
- Activity feed showing team collaboration

---

## Shared Components (All Teams)

- [ ] Each team adds their new tab to `EnterpriseDashboard.tsx`
- [ ] Each team adds their API routes to `backend/api/router.py`
- [ ] Each team creates their UI components in `src/components/`
- [ ] All new models go in `backend/models/`
- [ ] All new schemas go in `backend/schemas/`

## Dependencies & Order

```
Team 1 (Knowledge Graph) ──────┐
Team 2 (Explainability) ───────┼──► Can work in parallel
Team 3 (Batch & Reports) ──────┤
Team 4 (Real-time & Notify) ───┘
```

All 4 teams can work **in parallel** since they touch different:
- Backend modules (different agent files, different endpoints)
- Frontend components (different tabs, different pages)
- Database models (different tables)

The only shared file is `EnterpriseDashboard.tsx` (adding new tabs) and `router.py` (adding new routes), which are trivial merges.
