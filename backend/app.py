import json
import os
import re
import time
from collections import Counter

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from google import genai
import PyPDF2
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Load env
load_dotenv()

# Gemini setup
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "").strip()
DEFAULT_MODEL_CANDIDATES = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
]

if GEMINI_API_KEY:
    ai_client = genai.Client(api_key=GEMINI_API_KEY)
    model_name = GEMINI_MODEL or DEFAULT_MODEL_CANDIDATES[0]
else:
    ai_client = None
    model_name = None

app = Flask(__name__)
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:8080,http://127.0.0.1:8080"
).split(",") if origin.strip()]
CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
MIN_JOB_WORDS = 20
MAX_AI_RETRIES = 3

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he", "in", "is", "it", "its",
    "of", "on", "that", "the", "to", "was", "were", "will", "with", "you", "your", "we", "our", "or", "this",
    "these", "those", "there", "their", "can", "could", "should", "would", "like", "using", "use", "used",
    "via", "etc", "here", "clean", "build", "building", "make", "making", "role", "position",
}

TOKEN_SYNONYMS = {
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "ml": "machine-learning",
    "ai": "artificial-intelligence",
    "apis": "api",
    "frontend": "front-end",
    "backend": "back-end",
    "fullstack": "full-stack",
}

PHRASE_VARIANTS = {
    "machine-learning": ["machine learning", "ml"],
    "artificial-intelligence": ["artificial intelligence", "ai"],
    "full-stack": ["full stack", "full-stack", "fullstack"],
    "data-structures-and-algorithms": ["data structures", "algorithms", "dsa"],
    "rest-api": ["rest api", "restful api", "restful apis"],
}

ROLE_LEVELS = {"intern", "junior", "mid", "senior"}

# Extract text from PDF
def extract_text(file):
    reader = PyPDF2.PdfReader(file)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


def normalize_token(token):
    token = token.strip().lower()
    return TOKEN_SYNONYMS.get(token, token)

# Similarity score
def calculate_similarity(resume, job_desc):
    text = [resume, job_desc]
    try:
        tfidf = TfidfVectorizer(
            stop_words="english",
            ngram_range=(1, 2),
            lowercase=True,
        ).fit_transform(text)
        score = cosine_similarity(tfidf)[0][1]
    except ValueError:
        return 0.0
    return round(score * 100, 2)

# Keyword extraction
def extract_keyword_tokens(text):
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{1,}", text.lower())
    cleaned = []
    for token in tokens:
        normalized = normalize_token(token)
        if normalized not in STOPWORDS:
            cleaned.append(normalized)
    return cleaned


def extract_keywords(text):
    return set(extract_keyword_tokens(text))


def extract_phrase_keywords(text):
    lowered = text.lower()
    found = set()
    for canonical, variants in PHRASE_VARIANTS.items():
        for variant in variants:
            if variant in lowered:
                found.add(canonical)
                break
    return found


def top_keywords_by_frequency(tokens, limit=15):
    return [keyword for keyword, _ in Counter(tokens).most_common(limit)]


def prioritize_missing_keywords(job_tokens, resume_words, limit=15):
    ranked = []
    for keyword, _ in Counter(job_tokens).most_common():
        if keyword not in resume_words:
            ranked.append(keyword)
        if len(ranked) >= limit:
            break
    return ranked


def split_resume_sections(resume_text):
    lowered = resume_text.lower()
    heading_pattern = re.compile(r"\b(summary|objective|skills|experience|projects?|education)\b")
    matches = list(heading_pattern.finditer(lowered))
    if not matches:
        return {}

    sections = {}
    for idx, match in enumerate(matches):
        section_name = match.group(1)
        if section_name == "objective":
            section_name = "summary"
        if section_name == "project":
            section_name = "projects"

        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(resume_text)
        section_text = resume_text[start:end].strip()
        if section_text:
            sections[section_name] = (sections.get(section_name, "") + "\n" + section_text).strip()
    return sections


def calculate_section_scores(resume_text, job_tokens):
    section_order = ["summary", "skills", "experience", "projects", "education"]
    sections = split_resume_sections(resume_text)
    top_job_keywords = top_keywords_by_frequency(job_tokens, limit=20)
    denominator = max(len(top_job_keywords), 1)

    section_scores = {}
    for section in section_order:
        section_text = sections.get(section, "")
        if not section_text:
            section_scores[section] = 0.0
            continue

        section_tokens = set(extract_keyword_tokens(section_text))
        matches = len([kw for kw in top_job_keywords if kw in section_tokens])
        section_scores[section] = round((matches / denominator) * 100, 2)

    return section_scores


def infer_section_gaps(resume_text):
    text = resume_text.lower()
    gaps = []

    if "skills" not in text:
        gaps.append("Add a dedicated Skills section with grouped tools and languages.")
    if "project" not in text and "projects" not in text:
        gaps.append("Add a Projects section with 2-4 relevant projects.")
    if "experience" not in text and "intern" not in text:
        gaps.append("Add Experience/Internship section with measurable impact bullets.")
    if "summary" not in text and "objective" not in text:
        gaps.append("Add a short profile summary tailored to this specific role.")

    return gaps


def build_action_plan(score, missing_keywords, section_gaps, role_level):
    steps = []
    top_missing = missing_keywords[:5]

    if top_missing:
        steps.append(
            "Include these role-specific keywords naturally in skills and project bullets: "
            + ", ".join(top_missing)
            + "."
        )

    if score < 50:
        steps.append("Rewrite the top 2 project bullets so they directly mirror this job's responsibilities.")
    elif score < 75:
        steps.append("Strengthen alignment by tailoring summary and skills section to this role.")
    else:
        steps.append("Maintain current alignment and focus on stronger quantification in achievements.")

    if role_level == "intern":
        steps.append("Emphasize coursework, projects, and learning velocity instead of years of industry ownership.")
    elif role_level == "senior":
        steps.append("Highlight leadership impact, architecture decisions, and cross-team ownership outcomes.")

    steps.append("Add metrics to at least 3 bullets using a format like: improved X by Y% / reduced Z by Y hours.")

    for gap in section_gaps[:2]:
        steps.append(gap)

    return steps[:7]


def build_bullet_templates(missing_keywords, role_level, years_experience):
    templates = []
    prefix = "Collaborated with a team to" if role_level in {"intern", "junior"} else "Led the design to"
    impact = "improving delivery speed" if years_experience < 3 else "improving system reliability at scale"

    for keyword in missing_keywords[:3]:
        templates.append(
            f"{prefix} implement {keyword} in [project/system], resulting in [measurable outcome such as 20% faster processing]."
        )
        templates.append(
            f"Designed and shipped [feature] using {keyword}, {impact} for [users/team]."
        )
        if len(templates) >= 4:
            break
    return templates[:4]


def build_checklist(score, keyword_coverage, section_scores, missing_keywords, resume_text):
    has_summary = bool(re.search(r"\b(summary|objective)\b", resume_text.lower()))
    has_metrics = bool(re.search(r"\b\d+%\b|\b\d+\s*(ms|sec|seconds|hours|days|x)\b", resume_text.lower()))
    experience_score = section_scores.get("experience", 0)

    items = [
        {
            "id": "score",
            "label": "Resume score is at least 70",
            "completed": score >= 70,
            "reason": f"Current score: {score}%",
        },
        {
            "id": "coverage",
            "label": "Keyword coverage is at least 45%",
            "completed": keyword_coverage >= 45,
            "reason": f"Current coverage: {keyword_coverage}%",
        },
        {
            "id": "summary",
            "label": "Profile summary/objective is present",
            "completed": has_summary,
            "reason": "Detected summary section" if has_summary else "No summary/objective section detected",
        },
        {
            "id": "metrics",
            "label": "At least one quantified achievement exists",
            "completed": has_metrics,
            "reason": "Detected numeric impact" if has_metrics else "No measurable metrics found",
        },
        {
            "id": "experience",
            "label": "Experience section is aligned with job terms",
            "completed": experience_score >= 30,
            "reason": f"Experience alignment: {experience_score}%",
        },
        {
            "id": "gaps",
            "label": "High-priority keyword gaps are below 8",
            "completed": len(missing_keywords) < 8,
            "reason": f"Current high-priority gaps: {len(missing_keywords)}",
        },
    ]

    completed_count = len([item for item in items if item["completed"]])
    completion_percent = round((completed_count / len(items)) * 100, 2)
    return {
        "completion_percent": completion_percent,
        "items": items,
    }


def safe_ai_payload(message):
    return {
        "status": "unavailable",
        "message": message,
        "strengths": [],
        "weak_points": [],
        "rewritten_bullets": [],
        "skills_rewrite": "",
        "summary_rewrite": "",
        "interview_focus": [],
        "model_used": None,
    }


def extract_response_text(response):
    text = getattr(response, "text", "")
    if text:
        return text

    candidates = getattr(response, "candidates", None) or []
    if candidates:
        content = getattr(candidates[0], "content", None)
        parts = getattr(content, "parts", None) or []
        if parts and getattr(parts[0], "text", ""):
            return parts[0].text
    return ""


def parse_structured_ai(raw_text):
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```json\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^```", "", cleaned)
    cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return safe_ai_payload("AI returned non-JSON text. Showing deterministic guidance only.")

    def to_list(key):
        value = payload.get(key, [])
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]

    return {
        "status": "ok",
        "message": "",
        "strengths": to_list("strengths")[:6],
        "weak_points": to_list("weak_points")[:6],
        "rewritten_bullets": to_list("rewritten_bullets")[:6],
        "skills_rewrite": str(payload.get("skills_rewrite", "")).strip(),
        "summary_rewrite": str(payload.get("summary_rewrite", "")).strip(),
        "interview_focus": to_list("interview_focus")[:6],
        "model_used": None,
    }


def is_retryable_error(message):
    lowered = message.lower()
    return any(
        token in lowered
        for token in ["429", "quota", "rate", "500", "503", "timeout", "temporarily unavailable"]
    )


def ai_model_candidates():
    if GEMINI_MODEL:
        return [GEMINI_MODEL] + [m for m in DEFAULT_MODEL_CANDIDATES if m != GEMINI_MODEL]
    return list(DEFAULT_MODEL_CANDIDATES)

def get_ai_recommendations(resume, job, role_level, years_experience):
    if ai_client is None:
        return safe_ai_payload(
            "Gemini model is not available. Set GEMINI_API_KEY in backend/.env to enable AI recommendations."
        )

    prompt = f"""
You are an expert resume coach.

Return ONLY strict JSON with this schema:
{{
  "strengths": ["..."],
  "weak_points": ["..."],
  "rewritten_bullets": ["..."],
  "skills_rewrite": "...",
  "summary_rewrite": "...",
  "interview_focus": ["..."]
}}

Rules:
- No markdown, no backticks, no extra fields.
- Tailor for role level: {role_level}.
- Tailor for years of experience: {years_experience}.
- Rewritten bullets must be measurable and ATS-friendly.

Resume:
{resume}

Job Description:
{job}
"""

    last_error = ""
    for candidate_model in ai_model_candidates():
        for attempt in range(MAX_AI_RETRIES):
            try:
                response = ai_client.models.generate_content(
                    model=candidate_model,
                    contents=prompt,
                )
                text = extract_response_text(response)
                if not text:
                    raise ValueError("Empty AI response")

                parsed = parse_structured_ai(text)
                parsed["model_used"] = candidate_model
                return parsed
            except Exception as exc:
                message = str(exc)
                last_error = message

                if is_retryable_error(message) and attempt < MAX_AI_RETRIES - 1:
                    time.sleep(2 ** attempt)
                    continue

                # Quota exceeded on this model. Try next model candidate.
                if "quota" in message.lower() or "429" in message:
                    break
                # Non-retryable error; move to next model candidate.
                break

    if "quota" in last_error.lower() or "429" in last_error:
        retry_match = re.search(r"retry in\s+([0-9]+(?:\.[0-9]+)?)s", last_error, flags=re.IGNORECASE)
        retry_hint = ""
        if retry_match:
            retry_hint = f" Please retry in about {round(float(retry_match.group(1)))} seconds."
        return safe_ai_payload(
            "AI recommendations are temporarily unavailable due to quota/rate limits."
            + retry_hint
            + " Deterministic ATS guidance is still available."
        )

    return safe_ai_payload("AI recommendations are temporarily unavailable. Please try again shortly.")


def validate_request():
    file = request.files.get("resume")
    job_desc = (request.form.get("job_description") or "").strip()
    role_level = (request.form.get("role_level") or "junior").strip().lower()
    years_experience_raw = (request.form.get("years_experience") or "0").strip()

    if file is None:
        return None, None, None, None, (jsonify({"error": "Missing 'resume' file."}), 400)

    if not file.filename:
        return None, None, None, None, (jsonify({"error": "Resume filename is empty."}), 400)

    if not file.filename.lower().endswith(".pdf"):
        return None, None, None, None, (jsonify({"error": "Only PDF files are accepted."}), 400)

    file.stream.seek(0, os.SEEK_END)
    file_size = file.stream.tell()
    file.stream.seek(0)
    if file_size > MAX_FILE_SIZE_BYTES:
        return None, None, None, None, (jsonify({"error": "PDF exceeds 10MB limit."}), 400)

    if not job_desc:
        return None, None, None, None, (jsonify({"error": "Missing 'job_description'."}), 400)

    job_word_count = len(re.findall(r"\w+", job_desc))
    if job_word_count < MIN_JOB_WORDS:
        return None, None, None, None, (
            jsonify({
                "error": (
                    f"Job description is too short ({job_word_count} words). "
                    f"Please paste at least {MIN_JOB_WORDS} words for accurate matching."
                )
            }),
            400,
        )

    if role_level not in ROLE_LEVELS:
        role_level = "junior"

    try:
        years_experience = int(years_experience_raw)
    except ValueError:
        years_experience = 0
    years_experience = max(0, min(years_experience, 40))

    return file, job_desc, role_level, years_experience, None

# Main API
@app.route("/analyze", methods=["POST"])
def analyze():
    file, job_desc, role_level, years_experience, error_response = validate_request()
    if error_response:
        return error_response

    try:
        resume_text = extract_text(file)
        if not resume_text.strip():
            return jsonify({"error": "Could not extract text from the uploaded PDF."}), 400

        score = calculate_similarity(resume_text, job_desc)

        resume_tokens = extract_keyword_tokens(resume_text)
        job_tokens = extract_keyword_tokens(job_desc)
        resume_words = set(resume_tokens)
        job_words = set(job_tokens)

        resume_phrases = extract_phrase_keywords(resume_text)
        job_phrases = extract_phrase_keywords(job_desc)

        missing = prioritize_missing_keywords(job_tokens, resume_words, limit=15)
        missing_phrases = sorted(list(job_phrases - resume_phrases))
        matched_phrases = sorted(list(job_phrases & resume_phrases))
        matched = [word for word in top_keywords_by_frequency(job_tokens, limit=30) if word in resume_words][:15]
        keyword_coverage = round((len(job_words & resume_words) / max(len(job_words), 1)) * 100, 2)

        section_scores = calculate_section_scores(resume_text, job_tokens)

        section_gaps = infer_section_gaps(resume_text)
        action_plan = build_action_plan(score, missing, section_gaps, role_level)
        bullet_templates = build_bullet_templates(missing, role_level, years_experience)
        checklist = build_checklist(score, keyword_coverage, section_scores, missing, resume_text)

        ai_payload = get_ai_recommendations(
            resume_text[:1800],
            job_desc[:1800],
            role_level,
            years_experience,
        )

        fallback_text = ai_payload.get("message", "")
        if ai_payload.get("status") == "ok":
            suggestions = "\n".join(
                [
                    "Strengths:",
                    *[f"- {item}" for item in ai_payload.get("strengths", [])],
                    "",
                    "Weak Points:",
                    *[f"- {item}" for item in ai_payload.get("weak_points", [])],
                ]
            ).strip()
        else:
            suggestions = fallback_text

        return jsonify({
            "score": score,
            "role_level": role_level,
            "years_experience": years_experience,
            "keyword_coverage": keyword_coverage,
            "matched_keywords": matched,
            "missing_keywords": missing,
            "matched_phrases": matched_phrases,
            "missing_phrases": missing_phrases,
            "section_scores": section_scores,
            "action_plan": action_plan,
            "bullet_templates": bullet_templates,
            "checklist": checklist,
            "ai_recommendations": ai_payload,
            "suggestions": suggestions,
        })
    except PyPDF2.errors.PdfReadError:
        return jsonify({"error": "Invalid or corrupted PDF file."}), 400
    except Exception:
        return jsonify({"error": "Analysis failed due to an internal error."}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "gemini_enabled": ai_client is not None,
        "gemini_model": model_name,
    })

if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
    )