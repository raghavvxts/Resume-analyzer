import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, AlertCircle, Sparkles, Target, Lightbulb, TrendingUp } from "lucide-react";

interface AnalysisResult {
  score: number;
  role_level?: string;
  years_experience?: number;
  keyword_coverage?: number;
  matched_keywords?: string[];
  missing_keywords: string[];
  matched_phrases?: string[];
  missing_phrases?: string[];
  section_scores?: Record<string, number>;
  action_plan?: string[];
  bullet_templates?: string[];
  checklist?: {
    completion_percent: number;
    items: Array<{ id: string; label: string; completed: boolean; reason: string }>;
  };
  ai_recommendations?: {
    status: string;
    message: string;
    strengths: string[];
    weak_points: string[];
    rewritten_bullets: string[];
    skills_rewrite: string;
    summary_rewrite: string;
    interview_focus: string[];
    model_used?: string | null;
  };
  suggestions: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const MIN_JOB_WORDS = 20;

const formatSectionName = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

const formatInlineBold = (text: string) => {
  const chunks = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return chunks.map((chunk, idx) => {
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      return <strong key={idx} className="font-semibold text-foreground">{chunk.slice(2, -2)}</strong>;
    }
    return <span key={idx}>{chunk}</span>;
  });
};

const renderSuggestionBlocks = (text: string) => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const blocks: Array<{ type: "heading" | "bullet" | "numbered" | "paragraph"; content: string }> = [];

  for (const line of lines) {
    const cleanHeading = line.match(/^\*\*(.+)\*\*$/);
    if (cleanHeading) {
      blocks.push({ type: "heading", content: cleanHeading[1].trim() });
      continue;
    }

    const markdownHeading = line.match(/^#{1,6}\s+(.+)$/);
    if (markdownHeading) {
      blocks.push({ type: "heading", content: markdownHeading[1].trim() });
      continue;
    }

    const bullet = line.match(/^[*-]\s+(.+)$/);
    if (bullet) {
      blocks.push({ type: "bullet", content: bullet[1].trim() });
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      blocks.push({ type: "numbered", content: numbered[1].trim() });
      continue;
    }

    blocks.push({ type: "paragraph", content: line });
  }

  return (
    <div className="space-y-2.5 text-sm leading-7 text-muted-foreground">
      {blocks.map((block, idx) => {
        if (block.type === "heading") {
          return (
            <h4 key={idx} className="pt-2 text-sm font-bold tracking-[0.01em] text-foreground">
              {formatInlineBold(block.content)}
            </h4>
          );
        }

        if (block.type === "bullet") {
          return (
            <p key={idx} className="pl-4">
              <span className="mr-2 text-primary">•</span>
              {formatInlineBold(block.content)}
            </p>
          );
        }

        if (block.type === "numbered") {
          return (
            <p key={idx} className="pl-4">
              <span className="mr-2 text-primary">•</span>
              {formatInlineBold(block.content)}
            </p>
          );
        }

        return <p key={idx}>{formatInlineBold(block.content)}</p>;
      })}
    </div>
  );
};

const ScoreRing = ({ score }: { score: number }) => {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? "hsl(var(--primary))" : score >= 50 ? "hsl(40, 90%, 55%)" : "hsl(0, 72%, 55%)";

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground">{score}%</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">match</span>
      </div>
    </div>
  );
};

const UploadArea = ({ file, onFile, onRemove, dragOver, setDragOver, fileInputRef }: any) => (
  <div
    className={`group relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
      dragOver
        ? "border-primary bg-primary/5 scale-[1.01]"
        : file
        ? "border-primary/30 bg-card"
        : "border-border bg-card/50 hover:border-primary/40 hover:bg-card"
    }`}
    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
    onDragLeave={() => setDragOver(false)}
    onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
    onClick={() => fileInputRef.current?.click()}
  >
    <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    {file ? (
      <div className="flex items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div className="text-left">
          <p className="text-foreground font-medium text-sm">{file.name}</p>
          <p className="text-muted-foreground text-xs">{(file.size / 1024).toFixed(0)} KB · PDF</p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-4 text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2">Remove</button>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto group-hover:bg-primary/15 transition-colors">
          <Upload className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="text-foreground font-medium">Drop your resume here</p>
          <p className="text-muted-foreground text-sm mt-1">or <span className="text-primary underline underline-offset-2">browse files</span> · PDF only, up to 10MB</p>
        </div>
      </div>
    )}
  </div>
);

const ResultsSection = ({ result }: { result: AnalysisResult }) => (
  <div className="space-y-5 animate-fade-in-up">
    <div className="bg-card rounded-2xl p-8 border border-border flex flex-col sm:flex-row items-center gap-8">
      <ScoreRing score={result.score} />
      <div className="flex-1 text-center sm:text-left space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Resume Match Score</h3>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
          {result.score >= 75 ? "Great match! Your resume aligns well with this position." :
           result.score >= 50 ? "Decent match. A few tweaks could significantly improve your chances." :
           "Your resume needs work to match this role. Check the suggestions below."}
        </p>
        <div className="h-2 bg-secondary rounded-full overflow-hidden mt-3">
          <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${result.score}%` }} />
        </div>
      </div>
    </div>

    {result.missing_keywords?.length > 0 && (
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Missing Keywords</p>
          <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{result.missing_keywords.length} found</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {result.missing_keywords.map((kw, i) => (
            <span key={i} className="px-3 py-1.5 text-xs rounded-lg bg-chip text-chip-foreground font-medium border border-border/50">{kw}</span>
          ))}
        </div>
      </div>
    )}

    {result.matched_keywords?.length ? (
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Matched Keywords</p>
          {typeof result.keyword_coverage === "number" && (
            <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {result.keyword_coverage}% coverage
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {result.matched_keywords.map((kw, i) => (
            <span key={i} className="px-3 py-1.5 text-xs rounded-lg bg-primary/10 text-primary font-medium border border-primary/20">{kw}</span>
          ))}
        </div>
      </div>
    ) : null}

    {result.matched_phrases?.length ? (
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Matched Phrases</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {result.matched_phrases.map((phrase, i) => (
            <span key={i} className="px-3 py-1.5 text-xs rounded-lg bg-primary/10 text-primary font-medium border border-primary/20">{phrase}</span>
          ))}
        </div>
      </div>
    ) : null}

    {result.section_scores ? (
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Section Match Breakdown</p>
        </div>
        <div className="space-y-3">
          {Object.entries(result.section_scores).map(([section, value]) => (
            <div key={section} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{formatSectionName(section)}</span>
                <span className="text-muted-foreground">{value}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : null}

    {result.action_plan?.length ? (
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Action Plan</p>
        </div>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          {result.action_plan.map((step, i) => (
            <li key={i} className="leading-relaxed">{step}</li>
          ))}
        </ol>
        <div className="pt-4">
          <CopyButton label="Copy action plan" text={result.action_plan.map((s, i) => `${i + 1}. ${s}`).join("\n")} />
        </div>
      </div>
    ) : null}

    {result.bullet_templates?.length ? (
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Resume Bullet Templates</p>
        </div>
        <div className="space-y-2">
          {result.bullet_templates.map((item, i) => (
            <div key={i} className="text-sm text-muted-foreground leading-relaxed bg-secondary/40 rounded-lg px-3 py-2">
              {item}
            </div>
          ))}
        </div>
        <div className="pt-4">
          <CopyButton label="Copy templates" text={result.bullet_templates.join("\n")} />
        </div>
      </div>
    ) : null}

    {result.checklist ? (
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Resume Tailoring Checklist</p>
          <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {result.checklist.completion_percent}% complete
          </span>
        </div>
        <div className="space-y-2">
          {result.checklist.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border/60 bg-secondary/20 px-3 py-2">
              <p className={`text-sm ${item.completed ? "text-foreground" : "text-muted-foreground"}`}>
                {item.completed ? "[x]" : "[ ]"} {item.label}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
            </div>
          ))}
        </div>
      </div>
    ) : null}

    {result.ai_recommendations ? (
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Structured AI Recommendations</p>
          {result.ai_recommendations.model_used ? (
            <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {result.ai_recommendations.model_used}
            </span>
          ) : null}
        </div>

        {result.ai_recommendations.message ? (
          <p className="text-xs text-muted-foreground mb-4">{result.ai_recommendations.message}</p>
        ) : null}

        {result.ai_recommendations.strengths?.length ? (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Strengths</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {result.ai_recommendations.strengths.map((item, i) => <li key={i}>• {item}</li>)}
            </ul>
          </div>
        ) : null}

        {result.ai_recommendations.weak_points?.length ? (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Weak Points</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {result.ai_recommendations.weak_points.map((item, i) => <li key={i}>• {item}</li>)}
            </ul>
          </div>
        ) : null}

        {result.ai_recommendations.rewritten_bullets?.length ? (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Top 5 Tailored Bullets</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {result.ai_recommendations.rewritten_bullets.map((item, i) => <li key={i}>• {item}</li>)}
            </ul>
            <div className="pt-3">
              <CopyButton label="Copy tailored bullets" text={result.ai_recommendations.rewritten_bullets.join("\n")} />
            </div>
          </div>
        ) : null}

        {result.ai_recommendations.skills_rewrite ? (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Skills Section Rewrite</p>
            <div className="text-sm text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap">{result.ai_recommendations.skills_rewrite}</div>
            <div className="pt-3">
              <CopyButton label="Copy skills rewrite" text={result.ai_recommendations.skills_rewrite} />
            </div>
          </div>
        ) : null}

        {result.ai_recommendations.summary_rewrite ? (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Summary Rewrite</p>
            <div className="text-sm text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap">{result.ai_recommendations.summary_rewrite}</div>
            <div className="pt-3">
              <CopyButton label="Copy summary rewrite" text={result.ai_recommendations.summary_rewrite} />
            </div>
          </div>
        ) : null}

        {result.ai_recommendations.interview_focus?.length ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Interview Focus</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {result.ai_recommendations.interview_focus.map((item, i) => <li key={i}>• {item}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
    ) : null}

    {result.suggestions && (
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">AI Recommendations</p>
        </div>
        {renderSuggestionBlocks(result.suggestions)}
      </div>
    )}
  </div>
);

const CopyButton = ({ label, text }: { label: string; text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" onClick={handleCopy} className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary/15 border border-primary/30 text-primary hover:bg-primary/20 transition-colors">
      {copied ? "Copied" : label}
    </button>
  );
};

const Index = () => {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [roleLevel, setRoleLevel] = useState("junior");
  const [yearsExperience, setYearsExperience] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (f.type !== "application/pdf") { setError("Only PDF files are accepted."); return; }
    if (f.size > 10 * 1024 * 1024) { setError("PDF must be 10MB or smaller."); return; }
    setError(""); setFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) { setError("Please upload a resume first."); return; }
    if (!jobDescription.trim()) { setError("Please paste a job description."); return; }
    const words = jobDescription.trim().split(/\s+/).filter(Boolean).length;
    if (words < MIN_JOB_WORDS) {
      setError(`Please paste a fuller job description (at least ${MIN_JOB_WORDS} words).`);
      return;
    }
    setError(""); setLoading(true); setResult(null);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("job_description", jobDescription);
      formData.append("role_level", roleLevel);
      formData.append("years_experience", String(yearsExperience));
      const res = await fetch(`${API_BASE_URL}/analyze`, { method: "POST", body: formData });
      if (!res.ok) {
        let message = "Analysis failed. Please try again.";
        try {
          const data = await res.json();
          if (data?.error) {
            message = data.error;
          }
        } catch {
          // Keep fallback message when response body is not JSON.
        }
        throw new Error(message);
      }
      setResult(await res.json());
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-[860px] space-y-10">
        {/* Header */}
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Analysis
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-[-0.02em] leading-[1.05] text-foreground">
            Resume <span className="text-primary">Analyzer</span>
          </h1>
          <p className="text-muted-foreground text-[15px] sm:text-base max-w-xl mx-auto leading-7">
            Match your resume against any job description in seconds. Get actionable insights to land the interview.
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground tracking-[0.01em]">
          <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">1</span>Upload Resume</div>
          <div className="w-8 h-px bg-border" />
          <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">2</span>Add Job Description</div>
          <div className="w-8 h-px bg-border" />
          <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">3</span>Get Results</div>
        </div>

        <UploadArea file={file} onFile={handleFile} onRemove={() => setFile(null)} dragOver={dragOver} setDragOver={setDragOver} fileInputRef={fileInputRef} />

        {/* Job Description */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            Job Description
            <span className="text-xs text-muted-foreground font-normal">— paste the full listing for best results</span>
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            rows={6}
            className="w-full rounded-2xl bg-card/50 border border-border px-5 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none text-sm leading-7 tracking-[0.01em] transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Role Level</label>
            <select
              value={roleLevel}
              onChange={(e) => setRoleLevel(e.target.value)}
              className="w-full rounded-xl bg-card/50 border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="intern">Intern</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Years of Experience</label>
            <input
              type="number"
              min={0}
              max={40}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(Math.max(0, Math.min(40, Number(e.target.value) || 0)))}
              className="w-full rounded-xl bg-card/50 border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-xl border border-destructive/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-center">
          <Button variant="analyze" className="h-16 min-w-[220px] px-12 rounded-2xl text-lg tracking-[0.01em]" onClick={handleAnalyze} disabled={loading}>
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Analyzing your resume...</>
            ) : (
              <><TrendingUp className="w-5 h-5" />Analyze</>
            )}
          </Button>
        </div>

        {result && <ResultsSection result={result} />}

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground/60 pt-4">
          Your resume is processed securely and never stored. Powered by AI.
        </p>
      </div>
    </div>
  );
};

export default Index;
