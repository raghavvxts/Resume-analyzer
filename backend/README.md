Backend Setup

Requirements
- Python 3.10+
- Virtual environment (recommended)

Install dependencies

```bash
python -m pip install -r requirements.txt
```

Environment variables
- Copy `.env.example` to `.env`
- Required: `GEMINI_API_KEY`
- Optional: `GEMINI_MODEL`, `FRONTEND_ORIGINS`, `FLASK_DEBUG`, `FLASK_HOST`, `FLASK_PORT`

Run in development

```bash
python app.py
```

Run in production (WSGI)

```bash
gunicorn -w 2 -b 0.0.0.0:5000 wsgi:app
```

Run backend tests

```bash
python -m unittest -v test_app.py
```
