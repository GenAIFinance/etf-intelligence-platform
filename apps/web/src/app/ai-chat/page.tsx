'use client';

// AI Chat — Expert Portfolio Manager Advisory
// Deploy to: apps/web/src/app/ai-chat/page.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Send, Loader2, TrendingUp, TrendingDown, Minus,
  ShieldAlert, BookOpen, ChevronDown, ChevronUp, AlertTriangle,
  BarChart2, XCircle, Lightbulb, RefreshCw,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================================================
// TYPES
// ============================================================================

type Objective   = 'growth' | 'income' | 'preservation';
type RiskProfile = 'low' | 'medium' | 'high';
type Sentiment   = 'bullish' | 'bearish' | 'neutral' | 'mixed';

interface UserProfile { objective?: Objective; riskProfile?: RiskProfile; }

interface HistoryMessage { role: 'user' | 'assistant'; content: string; }

interface Metrics {
  return3Y:     number | null;
  volatility:   number | null;
  sharpe:       number | null;
  expenseRatio: number | null;
  dividendYield:number | null;
}

interface Recommendation {
  ticker:     string;
  name:       string;
  allocation: number | null;
  reasoning:  string;
  risks:      string;
  profile:    string[];
  metrics:    Metrics;
}

interface AvoidItem {
  ticker:      string;
  name:        string;
  reasoning:   string;
  alternative: string | null;
}

interface ChatResponse {
  analysis:        { macroView: string; keyRisks: string[]; sentiment: Sentiment; };
  recommendations: Recommendation[];
  avoid:           AvoidItem[];
  education:       Record<string, string>;
  disclaimer:      string;
}

interface ChatMessage {
  id:        string;
  role:      'user' | 'assistant';
  text:      string;          // user query text
  response?: ChatResponse;    // only for assistant messages
  error?:    string;
}

// ============================================================================
// HELPERS
// ============================================================================

function fmt(n: number | null, type: 'pct' | 'pct2' | 'num'): string {
  if (n === null || n === undefined) return 'N/A';
  switch (type) {
    case 'pct':  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
    case 'pct2': return `${(n * 100).toFixed(2)}%`;
    case 'num':  return n.toFixed(2);
    default:     return String(n);
  }
}

const SENTIMENT_CONFIG: Record<Sentiment, { icon: React.ReactElement; label: string; color: string }> = {
  bullish: { icon: <TrendingUp  className="w-4 h-4" />, label: 'Bullish',  color: 'text-emerald-400' },
  bearish: { icon: <TrendingDown className="w-4 h-4" />, label: 'Bearish', color: 'text-red-400'     },
  neutral: { icon: <Minus       className="w-4 h-4" />, label: 'Neutral',  color: 'text-slate-400'   },
  mixed:   { icon: <BarChart2   className="w-4 h-4" />, label: 'Mixed',    color: 'text-amber-400'   },
};

const EXAMPLE_QUERIES = [
  'The Fed just raised rates again — which ETFs benefit and which should I avoid?',
  'AI stocks are booming — how can I get exposure without chasing a bubble?',
  'I want income-focused ETFs in this high-rate environment. What should I consider?',
  'With geopolitical tensions rising, what defensive ETFs make sense right now?',
  'How should I think about inflation protection in my ETF portfolio?',
];

// ============================================================================
// DISCLOSURE MODAL
// ============================================================================

function DisclosureModal({ onAccept }: { onAccept: () => void }): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="modal-card max-w-lg w-full rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="font-display text-lg font-semibold text-slate-100">Important Disclosure</h2>
        </div>

        <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
          <p>
            The AI Portfolio Advisor provides <span className="text-amber-400 font-medium">educational and informational content only</span>. Nothing on this platform constitutes investment advice, a solicitation, or a recommendation to buy or sell any security.
          </p>
          <p>
            This tool uses AI (DeepSeek) to analyze market conditions and ETF data. AI analysis may be incomplete, biased, or incorrect. Market conditions change rapidly and past performance does not guarantee future results.
          </p>
          <p>
            <span className="text-slate-300 font-medium">Always consult a qualified, licensed financial advisor</span> before making any investment decisions. You are solely responsible for your own investment choices.
          </p>
          <p className="text-xs text-slate-600">
            Data sourced from EODHD under personal-use license. For personal use only — not for commercial distribution.
          </p>
        </div>

        <button
          onClick={onAccept}
          className="accept-btn w-full py-3 rounded-xl text-sm font-semibold transition-all"
        >
          I understand — this is not investment advice
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// RECOMMENDATION CARD
// ============================================================================

function RecCard({ rec }: { rec: Recommendation }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div className="rec-card rounded-xl overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-teal-400">{rec.ticker}</span>
              {rec.allocation !== null && (
                <span className="px-1.5 py-0.5 text-xs bg-teal-400/10 text-teal-400 border border-teal-400/20 rounded font-mono">
                  ~{rec.allocation}%
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 max-w-[220px] truncate">{rec.name}</div>
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            {rec.profile.map(p => (
              <span key={p} className="px-1.5 py-0.5 text-xs rounded bg-slate-800/80 text-slate-400 border border-slate-700/50">
                {p}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-2">{rec.reasoning}</p>

        {/* Mini metrics row */}
        <div className="grid grid-cols-4 gap-1 mb-2">
          {[
            { label: '3Y', value: fmt(rec.metrics.return3Y, 'pct'),  color: rec.metrics.return3Y != null && rec.metrics.return3Y >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Vol', value: fmt(rec.metrics.volatility, 'pct2'), color: 'text-slate-300' },
            { label: 'SR',  value: fmt(rec.metrics.sharpe, 'num'),    color: 'text-slate-300' },
            { label: 'ER',  value: fmt(rec.metrics.expenseRatio, 'pct2'), color: 'text-slate-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="metric-mini text-center rounded p-1">
              <div className="text-xs text-slate-600">{label}</div>
              <div className={`text-xs font-mono font-medium ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-xs text-slate-600 hover:text-amber-400 transition-colors"
        >
          <ShieldAlert className="w-3 h-3" />
          {open ? 'Hide risks' : 'View risks'}
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {open && (
          <div className="mt-2 px-2 py-1.5 rounded-lg bg-amber-400/5 border border-amber-400/15 text-xs text-amber-300/80 leading-relaxed">
            {rec.risks}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AVOID CARD
// ============================================================================

function AvoidCard({ item }: { item: AvoidItem }): React.ReactElement {
  return (
    <div className="avoid-card rounded-xl p-3 space-y-1">
      <div className="flex items-center gap-2">
        <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <span className="font-mono text-sm font-bold text-red-400">{item.ticker}</span>
        <span className="text-xs text-slate-500 truncate max-w-[180px]">{item.name}</span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{item.reasoning}</p>
      {item.alternative && (
        <p className="text-xs text-teal-400/80">
          → Consider instead: <span className="font-medium">{item.alternative}</span>
        </p>
      )}
    </div>
  );
}

// ============================================================================
// ASSISTANT RESPONSE BUBBLE
// ============================================================================

function ResponseBubble({ response }: { response: ChatResponse }): React.ReactElement {
  const [eduOpen, setEduOpen] = useState(false);
  const sentiment = SENTIMENT_CONFIG[response.analysis?.sentiment ?? 'neutral'];
  const hasEdu    = Object.keys(response.education ?? {}).length > 0;
  const hasAvoid  = (response.avoid ?? []).length > 0;

  return (
    <div className="space-y-3 w-full">
      {/* Macro analysis */}
      <div className="response-card rounded-2xl rounded-tl-sm p-4 space-y-3">
        <div className={`flex items-center gap-2 text-sm font-medium ${sentiment.color}`}>
          {sentiment.icon}
          <span>{sentiment.label} outlook</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{response.analysis?.macroView}</p>
        {(response.analysis?.keyRisks ?? []).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-slate-600 uppercase tracking-widest">Key risks</p>
            {response.analysis.keyRisks.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <AlertTriangle className="w-3 h-3 text-amber-500/60 mt-0.5 shrink-0" />
                <span>{r}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      {(response.recommendations ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 uppercase tracking-widest px-1">Considerations</p>
          {response.recommendations.map(rec => (
            <RecCard key={rec.ticker} rec={rec} />
          ))}
        </div>
      )}

      {/* Avoid */}
      {hasAvoid && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 uppercase tracking-widest px-1">Exercise caution with</p>
          {response.avoid.map(item => (
            <AvoidCard key={item.ticker} item={item} />
          ))}
        </div>
      )}

      {/* Education */}
      {hasEdu && (
        <div className="response-card rounded-xl overflow-hidden">
          <button
            onClick={() => setEduOpen(!eduOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 hover:text-teal-400 transition-colors"
          >
            <span className="flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" />Learn the concepts</span>
            {eduOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {eduOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-800/60">
              {Object.entries(response.education).map(([concept, explanation]) => (
                <div key={concept}>
                  <p className="text-xs font-semibold text-teal-400/80 mb-0.5">{concept}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{explanation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer — always shown */}
      <div className="disclaimer-strip rounded-xl px-3 py-2 flex items-start gap-2">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-500/60 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 leading-relaxed">{response.disclaimer}</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AiChatPage(): React.ReactElement {
  const [messages,        setMessages]        = useState<ChatMessage[]>([]);
  const [input,           setInput]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [showDisclosure,  setShowDisclosure]  = useState(true);
  const [profile,         setProfile]         = useState<UserProfile>({});
  const [profileOpen,     setProfileOpen]     = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Flatten messages into history for multi-turn context
  const buildHistory = (): HistoryMessage[] => {
    const out: HistoryMessage[] = [];
    for (const m of messages.slice(-8)) {
      if (m.role === 'user')    out.push({ role: 'user',      content: m.text });
      else if (m.response)      out.push({ role: 'assistant', content: JSON.stringify(m.response) });
    }
    return out;
  }; // last 4 turns

  const sendQuery = useCallback(async (q: string): Promise<void> => {
    const query = q.trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/ai-chat/query`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          query,
          userProfile: profile,
          history:     buildHistory(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Error ${res.status}`);
      }

      const data = await res.json() as ChatResponse;
      const assistantMsg: ChatMessage = {
        id:       (Date.now() + 1).toString(),
        role:     'assistant',
        text:     '',
        response: data,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again');
      // Remove the user message if fetch failed
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, profile, messages]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendQuery(input); }
  }

  function handleReset(): void {
    setMessages([]);
    setInput('');
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const isEmpty = messages.length === 0 && !loading;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oxanium:wght@400;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        :root {
          --bg:      #060b14;
          --surface: #0b1220;
          --border:  rgba(30,50,75,0.7);
          --teal:    #2dd4bf;
          --amber:   #f59e0b;
        }

        .chat-root   { font-family:'DM Sans',sans-serif; background:var(--bg); min-height:100vh; }
        .font-display{ font-family:'Oxanium',sans-serif; }
        .font-mono   { font-family:'JetBrains Mono',monospace !important; }

        .dot-grid {
          background-image: radial-gradient(rgba(45,212,191,0.05) 1px,transparent 1px);
          background-size: 28px 28px;
        }

        .header-bar {
          background:rgba(6,11,20,0.92);
          backdrop-filter:blur(12px);
          border-bottom:1px solid var(--border);
        }

        .modal-card {
          background:var(--surface);
          border:1px solid rgba(245,158,11,0.25);
          box-shadow:0 0 0 1px rgba(245,158,11,0.05), 0 20px 60px rgba(0,0,0,0.6);
        }

        .accept-btn {
          background:linear-gradient(135deg,#d97706,#b45309);
          color:#fff;
          border:1px solid rgba(245,158,11,0.3);
          box-shadow:0 2px 12px rgba(217,119,6,0.3);
        }
        .accept-btn:hover { background:linear-gradient(135deg,#f59e0b,#d97706); }

        .response-card {
          background:var(--surface);
          border:1px solid var(--border);
        }

        .rec-card {
          background:rgba(45,212,191,0.03);
          border:1px solid rgba(45,212,191,0.12);
        }

        .avoid-card {
          background:rgba(239,68,68,0.03);
          border:1px solid rgba(239,68,68,0.12);
        }

        .metric-mini {
          background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.04);
        }

        .disclaimer-strip {
          background:rgba(245,158,11,0.04);
          border:1px solid rgba(245,158,11,0.12);
        }

        .sticky-disclaimer {
          background:rgba(245,158,11,0.06);
          border-bottom:1px solid rgba(245,158,11,0.15);
        }

        .chat-input {
          background:rgba(255,255,255,0.02);
          border:1px solid var(--border);
          color:#e2e8f0;
          resize:none;
          transition:border-color 0.2s,box-shadow 0.2s;
        }
        .chat-input:focus {
          outline:none;
          border-color:rgba(45,212,191,0.4);
          box-shadow:0 0 0 3px rgba(45,212,191,0.05);
        }
        .chat-input::placeholder { color:#334155; }

        .send-btn {
          background:rgba(45,212,191,0.12);
          border:1px solid rgba(45,212,191,0.25);
          color:var(--teal);
          transition:all 0.15s;
        }
        .send-btn:hover:not(:disabled) {
          background:rgba(45,212,191,0.22);
          box-shadow:0 0 12px rgba(45,212,191,0.2);
        }
        .send-btn:disabled { opacity:0.3;cursor:not-allowed; }

        .user-bubble {
          background:linear-gradient(135deg,rgba(45,212,191,0.18),rgba(45,212,191,0.08));
          border:1px solid rgba(45,212,191,0.22);
          color:#e2e8f0;
        }

        .example-btn {
          background:rgba(255,255,255,0.02);
          border:1px solid var(--border);
          color:#475569;
          transition:all 0.15s;
          text-align:left;
        }
        .example-btn:hover:not(:disabled) {
          border-color:rgba(45,212,191,0.3);
          color:var(--teal);
          background:rgba(45,212,191,0.04);
        }

        .profile-panel {
          background:var(--surface);
          border:1px solid var(--border);
        }

        .profile-chip {
          border:1px solid rgba(255,255,255,0.08);
          color:#475569;
          background:rgba(255,255,255,0.02);
          transition:all 0.15s;
        }
        .profile-chip.active {
          border-color:rgba(45,212,191,0.35);
          color:var(--teal);
          background:rgba(45,212,191,0.08);
        }
        .profile-chip:hover:not(.active) { color:#94a3b8; }

        .footer-bar {
          background:rgba(6,11,20,0.95);
          border-top:1px solid var(--border);
          backdrop-filter:blur(12px);
        }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .fade-up { animation:fadeUp 0.25s ease-out; }
      `}</style>

      <div className="chat-root">
        {showDisclosure && <DisclosureModal onAccept={() => setShowDisclosure(false)} />}

        {/* Header */}
        <div className="header-bar sticky top-0 z-10 py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-1.5 text-slate-500 hover:text-teal-400 transition-colors rounded-lg hover:bg-white/5">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-display text-lg font-semibold text-slate-100 tracking-wide">
                  Portfolio Advisor
                  <span className="ml-2 text-xs font-mono text-amber-400/60 font-normal">AI · not advice</span>
                </h1>
                <p className="text-xs text-slate-600">Ask any market or ETF question in plain English</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-teal-400 border border-slate-800 hover:border-teal-500/30 rounded-lg transition-all"
              >
                {profile.objective ? `${profile.objective} · ${profile.riskProfile ?? '—'}` : 'Set profile'}
              </button>
              {messages.length > 0 && (
                <button onClick={handleReset}
                  className="p-1.5 text-slate-600 hover:text-slate-300 rounded-lg hover:bg-white/5 transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Optional profile panel */}
          {profileOpen && (
            <div className="max-w-2xl mx-auto mt-3">
              <div className="profile-panel rounded-xl p-3 space-y-2">
                <p className="text-xs text-slate-600 uppercase tracking-widest">Your profile (optional — improves recommendations)</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-slate-600 self-center">Objective:</span>
                  {(['growth','income','preservation'] as Objective[]).map(o => (
                    <button key={o} onClick={() => setProfile(p => ({ ...p, objective: p.objective === o ? undefined : o }))}
                      className={`profile-chip px-3 py-1 rounded-full text-xs font-medium ${profile.objective === o ? 'active' : ''}`}>
                      {o.charAt(0).toUpperCase() + o.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-slate-600 self-center">Risk:</span>
                  {(['low','medium','high'] as RiskProfile[]).map(r => (
                    <button key={r} onClick={() => setProfile(p => ({ ...p, riskProfile: p.riskProfile === r ? undefined : r }))}
                      className={`profile-chip px-3 py-1 rounded-full text-xs font-medium ${profile.riskProfile === r ? 'active' : ''}`}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky disclaimer banner */}
        <div className="sticky-disclaimer py-1.5 px-4 text-center">
          <p className="text-xs text-amber-500/60">
            <ShieldAlert className="inline w-3 h-3 mr-1 mb-0.5" />
            Educational purposes only · Not investment advice · Consult a financial advisor before making any decisions
          </p>
        </div>

        {/* Body */}
        <div className="dot-grid min-h-screen">
          <div className="max-w-2xl mx-auto px-4 pt-6 pb-36 space-y-5">

            {/* Empty state */}
            {isEmpty && (
              <div className="space-y-4 fade-up">
                <div className="text-center py-6 space-y-2">
                  <p className="font-display text-2xl font-semibold text-slate-300">Ask anything about markets</p>
                  <p className="text-sm text-slate-600">Get expert macro analysis and ETF context — in plain English</p>
                </div>
                <div>
                  <p className="text-xs text-slate-700 uppercase tracking-widest mb-2 px-1">Example questions</p>
                  <div className="space-y-2">
                    {EXAMPLE_QUERIES.map(q => (
                      <button key={q} onClick={() => void sendQuery(q)}
                        className="example-btn w-full px-4 py-2.5 text-sm rounded-xl">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Message thread */}
            {messages.map(msg => (
              <div key={msg.id} className="fade-up">
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="user-bubble max-w-sm px-4 py-2.5 rounded-2xl rounded-tr-sm">
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  </div>
                ) : msg.response ? (
                  <ResponseBubble response={msg.response} />
                ) : msg.error ? (
                  <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400">{msg.error}</p>
                  </div>
                ) : null}
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="fade-up response-card rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {[0,150,300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                  <span className="text-sm text-slate-500">Analysing markets…</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="fade-up flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="footer-bar fixed bottom-0 left-0 right-0 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about macro trends, ETFs, rate decisions, sector rotations…"
                rows={2}
                disabled={loading}
                className="chat-input w-full px-4 py-3 pr-12 text-sm rounded-xl disabled:opacity-50"
              />
              <button onClick={() => void sendQuery(input)} disabled={!input.trim() || loading}
                className="send-btn absolute right-3 bottom-3 p-1.5 rounded-lg">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-700 mt-1.5 text-center">
              ↵ Enter to send · Shift+Enter for new line · Not investment advice
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
