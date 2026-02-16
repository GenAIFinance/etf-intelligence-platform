import { z } from 'zod';

// Query Schemas
export const etfQuerySchema = z.object({
  search: z.string().optional(),
  assetClass: z.string().optional(),
  strategyType: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const priceQuerySchema = z.object({
  range: z.enum(['1m', '3m', '6m', '1y', '3y', '5y']).default('5y'),
  interval: z.enum(['1d', '1w']).default('1d'),
});

export const metricsQuerySchema = z.object({
  asOf: z.string().optional(),
});

export const newsQuerySchema = z.object({
  query: z.string().optional(),
  ticker: z.string().optional(),
  theme: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

export const topImpactQuerySchema = z.object({
  window: z.enum(['1d', '7d']).default('7d'),
});

// Body Schemas
export const manualNewsSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).max(500),
  source: z.string().min(1).max(100),
  publishedAt: z.string().datetime().optional(),
  snippet: z.string().max(2000).optional(),
});

// Param Schemas
export const tickerParamSchema = z.object({
  ticker: z.string().min(1).max(10).toUpperCase(),
});

// Types from schemas
export type EtfQuery = z.infer<typeof etfQuerySchema>;
export type PriceQuery = z.infer<typeof priceQuerySchema>;
export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
export type NewsQuery = z.infer<typeof newsQuerySchema>;
export type TopImpactQuery = z.infer<typeof topImpactQuerySchema>;
export type ManualNewsBody = z.infer<typeof manualNewsSchema>;
export type TickerParam = z.infer<typeof tickerParamSchema>;
