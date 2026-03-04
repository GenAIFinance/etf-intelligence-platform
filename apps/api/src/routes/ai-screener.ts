// AI Screener — DeepSeek NLP Route
// apps/api/src/routes/ai-screener.ts
//
// POST /api/ai-screener/nlp
//   Body:  { query: string, previousRequest?: ScreenerRequest, feedbackHint?: FeedbackHint }
//   Reply: { request: ScreenerRequest, interpretation: string, confidence: Confidence }
//
// Calls DeepSeek (deepseek-chat) to extract structured ScreenerRequest from free-text.
// DeepSeek returns percent-based numerics + capitalized enums — this layer normalises
// them to the exact shapes expected by screener.ts before returning.
// Zero changes to screener.ts.

import { FastifyInstance } from 'fastify';
import axios, { AxiosError } from 'axios';
import type {
  ScreenerRequest,
  ScreenerConstraints,
  Objective,
  RiskProfile,
  EsgPreference,
} from '../services/screener';

// ============================================================================
// TYPES
// ============================================================================

export type FeedbackHint = 'too_risky' | 'too_conservative' | 'too_expensive' | 'not_aligned';
export type Confidence   = 'high' | 'medium' | 'low';

export interface AiScreenerRequest {
  query: string;
  previousRequest?: ScreenerRequest;
  feedbackHint?: FeedbackHint;
}

export interface AiScreenerResponse {
  request: ScreenerRequest;
  interpretation: string;
  confidence: Confidence;
}

// DeepSeek extraction output (before normalisation)
// Enums are Title-cased; numerics are in human-readable units (%, $B)
interface DeepSeekExtraction {
  objective:   'Growth' | 'Income' | 'Preservation';
  riskProfile: 'Low'    | 'Medium' | 'High';
  constraints: {
    maxExpenseRatio: number | null;   // percent  e.g. 0.2  = 0.2%
    minAUM:          number | null;   // billions e.g. 1    = $1B
    minSharpe:       number | null;   // ratio    e.g. 0.5
    minReturn3Y:     number | null;   // percent  e.g. 10   = 10%
    minReturn5Y:     number | null;   // percent  e.g. 8    = 8%
    maxVolatility:   number | null;   // percent  e.g. 15   = 15%
    excludeSectors:  string[] | null;
    esgPreference:   boolean | null;  // true = prefer, false = exclude, null = no_preference
  };
  interpretation: string;
  confidence: Confidence;
}

// ============================================================================
// PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are an assistant that extracts structured parameters from ETF screening queries.
The user describes what they want in plain English. Your job is to output a JSON object with the following fields:

{
  "objective": "Growth" | "Income" | "Preservation",
  "riskProfile": "Low" | "Medium" | "High",
  "constraints": {
    "maxExpenseRatio": number | null,   // in percent (e.g., 0.2 means 0.2%)
    "minAUM": number | null,            // in billions USD (e.g., 1 means $1B)
    "minSharpe": number | null,         // ratio (e.g., 0.5)
    "minReturn3Y": number | null,       // in percent (e.g., 10 means 10%)
    "minReturn5Y": number | null,       // in percent (e.g., 8 means 8%)
    "maxVolatility": number | null,     // in percent (e.g., 15 means 15%)
    "excludeSectors": string[] | null,  // array of lowercase sector names e.g. ["oil","tobacco"]
    "esgPreference": boolean | null     // true = prefer ESG, false = exclude ESG, null = no preference
  },
  "interpretation": string,            // 2-3 sentence plain-English summary of what you understood
  "confidence": "high" | "medium" | "low"  // how clearly the query expressed objective + risk
}

Inference rules:
- objective:     "growth" / "capital appreciation" / "long-term" → Growth
                 "income" / "dividend" / "yield" / "cashflow"    → Income
                 "preserve" / "stable" / "protect" / "low risk"  → Preservation
- riskProfile:   "conservative" / "safe" / "stable"             → Low
                 "moderate" / "balanced"                         → Medium
                 "aggressive" / "high growth" / "momentum"       → High
                 If not stated, infer from objective + volatility cues.
- maxExpenseRatio: "low cost" → 0.20; "very low cost" / "index" / "passive" → 0.10;
                   explicit "under 0.3%" → 0.30; null if not mentioned.
- minAUM:        "large" → 1; "very large" / "mega" → 5; null if not mentioned.
- minSharpe:     "good risk-adjusted" → 0.5; "high Sharpe" → 1.0; null if not mentioned.
- minReturn3Y/5Y: extract number from phrases like "10% 3-year return" → 10; null if not mentioned.
- maxVolatility: "low volatility" → 15; "very low volatility" → 10; explicit % → that number; null if not.
- excludeSectors: extract lowercase keywords: "no oil" → ["oil"]; null if none.
- esgPreference: "ESG" / "sustainable" / "responsible" / "SRI" mentioned → true;
                 "no ESG" / "exclude ESG" → false; not mentioned → null.
- confidence:    "high"   = objective AND riskProfile explicitly stated.
                 "medium" = one inferred from context, other stated.
                 "low"    = both inferred or query is ambiguous.
- interpretation: Be specific. Mention the detected objective, risk level, and list each non-null constraint.

Only include fields that are explicitly mentioned or can be reasonably inferred.
Return ONLY the raw JSON object — no markdown fences, no preamble, no explanation.`;

const FEEDBACK_CONTEXT: Record<FeedbackHint, string> = {
  too_risky:        'The user found the previous results too risky. Lower riskProfile one notch and/or tighten maxVolatility.',
  too_conservative: 'The user wants more upside. Raise riskProfile one notch and/or relax volatility constraints.',
  too_expensive:    'The user wants lower costs. Reduce maxExpenseRatio — halve the current value if set, otherwise set 0.20.',
  not_aligned:      'The user felt results were misaligned. Re-evaluate objective and riskProfile carefully from the new query.',
};

// ============================================================================
// NORMALISATION — DeepSeek units → screener.ts units
// ============================================================================

function normalise(raw: DeepSeekExtraction): ScreenerRequest {
  // Objective + riskProfile: Title-case → lowercase
  const objectiveMap: Record<string, Objective> = {
    growth: 'growth', income: 'income', preservation: 'preservation',
  };
  const riskMap: Record<string, RiskProfile> = {
    low: 'low', medium: 'medium', high: 'high',
  };

  const objective:   Objective    = objectiveMap[raw.objective?.toLowerCase()]   ?? 'growth';
  const riskProfile: RiskProfile  = riskMap[raw.riskProfile?.toLowerCase()]       ?? 'medium';

  // esgPreference: boolean | null → three-way enum
  const esgPreference: EsgPreference =
    raw.constraints.esgPreference === true  ? 'prefer'        :
    raw.constraints.esgPreference === false ? 'exclude'       :
                                              'no_preference';

  const constraints: ScreenerConstraints = {
    maxExpenseRatio: pctToDecimal(raw.constraints.maxExpenseRatio),   // 0.2   → 0.002
    minAUM:          billionsToUsd(raw.constraints.minAUM),           // 1     → 1_000_000_000
    minSharpe:       safeNum(raw.constraints.minSharpe),              // ratio — no conversion
    minReturn3Y:     pctToDecimal(raw.constraints.minReturn3Y),       // 10    → 0.10
    minReturn5Y:     pctToDecimal(raw.constraints.minReturn5Y),       // 8     → 0.08
    maxVolatility:   pctToDecimal(raw.constraints.maxVolatility),     // 15    → 0.15
    excludeSectors:  Array.isArray(raw.constraints.excludeSectors)
                       ? raw.constraints.excludeSectors.map(s => s.toLowerCase())
                       : [],
    esgPreference,
  };

  return { objective, riskProfile, constraints, page: 1, pageSize: 25, sortBy: 'totalScore' };
}

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

export async function aiScreenerRoutes(fastify: FastifyInstance) {

  fastify.post<{ Body: AiScreenerRequest }>('/api/ai-screener/nlp', async (request, reply) => {
    const { query, previousRequest, feedbackHint } = request.body;

    // ── Input validation ────────────────────────────────────────────────────
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return reply.status(400).send({ error: 'query is required' });
    }
    if (query.trim().length > 600) {
      return reply.status(400).send({ error: 'Query must be under 600 characters' });
    }

    // ── Build user message ──────────────────────────────────────────────────
    let userMessage = `Query: "${query.trim()}"`;

    if (previousRequest) {
      // Convert back to human-readable units for the prompt context
      const prev = previousRequest;
      userMessage +=
        `\n\nPrevious screening parameters (preserve unchanged fields):\n` +
        JSON.stringify({
          objective:   capitalise(prev.objective),
          riskProfile: capitalise(prev.riskProfile),
          constraints: {
            maxExpenseRatio: prev.constraints.maxExpenseRatio !== null
              ? +(prev.constraints.maxExpenseRatio * 100).toFixed(4) : null,
            minAUM:          prev.constraints.minAUM !== null
              ? +(prev.constraints.minAUM / 1e9).toFixed(2) : null,
            minSharpe:       prev.constraints.minSharpe,
            minReturn3Y:     prev.constraints.minReturn3Y !== null
              ? +(prev.constraints.minReturn3Y * 100).toFixed(2) : null,
            minReturn5Y:     prev.constraints.minReturn5Y !== null
              ? +(prev.constraints.minReturn5Y * 100).toFixed(2) : null,
            maxVolatility:   prev.constraints.maxVolatility !== null
              ? +(prev.constraints.maxVolatility * 100).toFixed(2) : null,
            excludeSectors:  prev.constraints.excludeSectors,
            esgPreference:
              prev.constraints.esgPreference === 'prefer'  ? true  :
              prev.constraints.esgPreference === 'exclude' ? false : null,
          },
        }, null, 2);
    }

    if (feedbackHint) {
      userMessage += `\n\nAdjustment context: ${FEEDBACK_CONTEXT[feedbackHint]}`;
    }

    // ── Call DeepSeek ───────────────────────────────────────────────────────
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      fastify.log.error('DEEPSEEK_API_KEY is not set');
      return reply.status(500).send({ error: 'AI service not configured' });
    }

    try {
      const dsResponse = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model:       'deepseek-chat',
          temperature: 0,          // deterministic extraction
          max_tokens:  512,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: userMessage   },
          ],
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type':  'application/json',
          },
          timeout: 15_000,
        }
      );

      const rawText: string = dsResponse.data?.choices?.[0]?.message?.content ?? '';

      // Strip accidental markdown fences
      const jsonText = rawText
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m,       '')
        .trim();

      // ── Parse ─────────────────────────────────────────────────────────────
      let extracted: DeepSeekExtraction;
      try {
        extracted = JSON.parse(jsonText);
      } catch {
        fastify.log.error({ rawText }, 'ai-screener: JSON parse failed');
        return reply.status(422).send({
          error: 'Could not parse your query — try rephrasing it more specifically',
        });
      }

      // ── Validate confidence enum ──────────────────────────────────────────
      const validConfidence: Confidence[] = ['high', 'medium', 'low'];
      const confidence: Confidence = validConfidence.includes(extracted.confidence)
        ? extracted.confidence
        : 'medium';

      // ── Normalise units + enums ───────────────────────────────────────────
      const screenerRequest = normalise(extracted);

      const result: AiScreenerResponse = {
        request:        screenerRequest,
        interpretation: typeof extracted.interpretation === 'string'
          ? extracted.interpretation.trim()
          : 'Parameters extracted from your query.',
        confidence,
      };

      fastify.log.info({
        query:      query.trim(),
        objective:  screenerRequest.objective,
        riskProfile: screenerRequest.riskProfile,
        confidence,
      }, 'ai-screener: parse complete');

      return reply.send(result);

    } catch (err) {
      const axErr = err as AxiosError;
      fastify.log.error(err, 'ai-screener: DeepSeek API error');

      if (axErr.response?.status === 401) return reply.status(500).send({ error: 'DeepSeek API key is invalid or missing' });
      if (axErr.response?.status === 429) return reply.status(429).send({ error: 'AI rate limit reached — please try again in a moment' });
      if (axErr.code === 'ECONNABORTED')  return reply.status(504).send({ error: 'AI request timed out — please try again' });

      return reply.status(500).send({ error: 'Failed to process your query' });
    }
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function safeNum(v: unknown): number | null {
  return typeof v === 'number' && isFinite(v) ? v : null;
}

// Percent (e.g. 0.2, 10, 15) → decimal (0.002, 0.10, 0.15)
function pctToDecimal(v: unknown): number | null {
  const n = safeNum(v);
  return n !== null ? n / 100 : null;
}

// Billions (e.g. 1, 5) → USD (1_000_000_000, 5_000_000_000)
function billionsToUsd(v: unknown): number | null {
  const n = safeNum(v);
  return n !== null ? n * 1e9 : null;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
