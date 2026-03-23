AI Resume Analyzer Setup

This app has two parts:
- Flask backend API in backend
- Vite React frontend in frontend

1. Backend setup

- Open a terminal in backend.
- Activate your virtual environment.
- Install dependencies:

```bash
pip install -r requirements.txt
```

- Create backend/.env from backend/.env.example and set GEMINI_API_KEY.
- Optional: set GEMINI_MODEL if your key does not support the default model name.
- Start backend:

```bash
python app.py
```

Backend runs on http://127.0.0.1:5000 by default.

2. Frontend setup

- Open a terminal in frontend.
- Install dependencies:

```bash
npm install
```

- Create frontend/.env from frontend/.env.example.
- Start frontend:

```bash
npm run dev
```

Frontend runs on http://localhost:8080 by default.

3. Connection check

- The frontend calls VITE_API_BASE_URL/analyze.
- Default is http://127.0.0.1:5000/analyze.
- Health endpoint: http://127.0.0.1:5000/health

If you deploy, set VITE_API_BASE_URL and FRONTEND_ORIGINS for your deployed domains.

