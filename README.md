# AI Resume Matcher

An intelligent resume analysis tool that matches your resume against job descriptions using AI-powered recommendations and detailed scoring.

## Features

✨ **Smart Resume Analysis**
- Automatic resume parsing (PDF/text upload)
- Job description analysis
- Keyword matching and scoring
- Resume section breakdown (Summary, Skills, Experience, Projects, Education)

🎯 **Personalization**
- Select your experience level (Intern, Junior, Mid, Senior)
- Input years of experience
- Get tailored recommendations based on your profile

📊 **Detailed Results**
- Section-wise keyword coverage scoring
- Matched and missing keywords/phrases
- Interactive completion checklist
- AI-generated improvement suggestions
- Rewritten bullet points and skills recommendations

🚀 **Actionable Insights**
- Copy-ready bullet points for resume updates
- Skills rewrite suggestions
- Summary optimization tips
- Interview preparation focus areas
- Action plan with next steps

## Tech Stack

**Backend**
- Flask web framework
- Google Gemini AI API (gemini-2.5-flash)
- PyPDF2 for PDF extraction
- scikit-learn for TF-IDF matching
- Gunicorn for production serving

**Frontend**
- React 18 with TypeScript
- Tailwind CSS for styling
- shadcn/ui component library
- Vite build tool
- Vitest for testing

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 18+
- Google Gemini API key ([Get one free](https://ai.google.dev))

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Add your GEMINI_API_KEY

# Run development server
python app.py

# Or run with Gunicorn (production)
gunicorn -w 2 -b 0.0.0.0:5000 wsgi:app
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
bun install  # or npm install

# Set environment variable
export VITE_API_BASE_URL=http://localhost:5000

# Run development server
bun dev  # or npm run dev

# Build for production
bun run build  # or npm run build
```

## Usage

1. **Upload Resume** - Select a PDF or paste your resume text
2. **Paste Job Description** - Add the job posting you're targeting
3. **Personalize** - Select your experience level and years of experience
4. **Analyze** - Click the Analyze button
5. **Review Results** - Check keyword coverage, checklist, and AI recommendations
6. **Implement** - Copy suggestions into your resume

## Deployment

### Backend (Render)

1. Create a new Render Web Service
2. Connect your GitHub repository (root: `backend`)
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn -w 2 -b 0.0.0.0:$PORT wsgi:app`
5. Set environment variables (see [backend/README.md](backend/README.md))

### Frontend (Vercel)

1. Create a new Vercel project
2. Connect your GitHub repository (root: `frontend`)
3. Build command: `npm run build`
4. Output directory: `dist`
5. Set `VITE_API_BASE_URL` environment variable to your Render backend URL

## Project Structure

```
.
├── backend/
│   ├── app.py                 # Main Flask application
│   ├── requirements.txt        # Python dependencies
│   ├── wsgi.py               # WSGI entry point for production
│   ├── test_app.py           # Unit tests
│   └── README.md             # Backend documentation
│
└── frontend/
    ├── src/
    │   ├── App.tsx           # Main app component
    │   ├── pages/
    │   │   └── Index.tsx     # Resume matcher interface
    │   ├── components/       # React components
    │   └── lib/              # Utilities
    ├── vite.config.ts        # Vite configuration
    ├── tailwind.config.ts    # Tailwind CSS config
    └── package.json          # Node dependencies
```

## Testing

### Backend Tests

```bash
cd backend
pytest test_app.py -v
```

## Algorithm

**Keyword Matching**
- Token normalization (synonyms: js→javascript, ml→machine-learning)
- TF-IDF vectorization for relevance scoring
- Phrase variant detection (machine learning/ML/ml variations)

**Section Scoring**
- Resume split into 5 sections (Summary, Skills, Experience, Projects, Education)
- Per-section keyword coverage calculated
- Weighted scoring based on section importance

**AI Recommendations**
- Structured JSON output from Gemini with retry logic
- Fallback to alternative models if quota exceeded
- Exponential backoff for rate limiting
- Context-aware suggestions based on experience level

## API Reference

See [backend/README.md](backend/README.md) for detailed API endpoint documentation.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

Created by [Raghav Vats](https://github.com/raghavvats)

## Support

For issues, questions, or feedback, please open an issue on GitHub.

---

**Note**: This tool is designed for personal resume optimization. Always verify that your resume accurately represents your qualifications and experience when implementing suggestions.
