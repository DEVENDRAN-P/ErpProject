# ProductPilot AI Backend

## Run locally

1. Create `.env` from `.env.example`
2. Install Python dependencies:
   ```powershell
   python -m pip install -r requirements.txt
   ```
3. Initialize the database:
   ```powershell
   python backend/db/init_db.py
   ```
4. Start the backend:
   ```powershell
   python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   or:
   ```powershell
   python backend/app.py
   ```

## APIs

- `GET /api/health`
- `POST /api/auth/token`
- `POST /api/auth/register`
- `POST /api/products/ingest`
- `POST /api/products/upload`
- `POST /api/workflow/process`
