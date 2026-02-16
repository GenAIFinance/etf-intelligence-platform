import { Theme } from './types';

export const THEME_TAXONOMY: Theme[] = [
  {
    id: 'ai-ml',
    name: 'Artificial Intelligence & Machine Learning',
    keywords: ['artificial intelligence', 'machine learning', 'ai', 'ml', 'neural network', 'deep learning', 'chatgpt', 'llm', 'generative ai', 'automation'],
    sectorHints: ['Technology', 'Information Technology', 'Communication Services'],
    description: 'Companies developing or heavily utilizing AI and ML technologies',
  },
  {
    id: 'semiconductors',
    name: 'Semiconductors',
    keywords: ['semiconductor', 'chip', 'chipmaker', 'gpu', 'cpu', 'processor', 'foundry', 'wafer', 'fab', 'integrated circuit', 'memory'],
    sectorHints: ['Technology', 'Information Technology', 'Semiconductors'],
    description: 'Semiconductor design, manufacturing, and equipment companies',
  },
  {
    id: 'cloud-computing',
    name: 'Cloud Computing & SaaS',
    keywords: ['cloud', 'saas', 'software as a service', 'aws', 'azure', 'gcp', 'data center', 'infrastructure', 'iaas', 'paas'],
    sectorHints: ['Technology', 'Information Technology', 'Software'],
    description: 'Cloud infrastructure and software-as-a-service providers',
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    keywords: ['cybersecurity', 'security', 'firewall', 'encryption', 'threat', 'identity', 'authentication', 'zero trust', 'endpoint'],
    sectorHints: ['Technology', 'Information Technology', 'Software'],
    description: 'Companies focused on digital security solutions',
  },
  {
    id: 'fintech',
    name: 'Financial Technology',
    keywords: ['fintech', 'payment', 'digital payment', 'blockchain', 'crypto', 'defi', 'neobank', 'lending platform', 'insurtech'],
    sectorHints: ['Financials', 'Technology', 'Information Technology'],
    description: 'Technology companies disrupting financial services',
  },
  {
    id: 'healthcare-biotech',
    name: 'Healthcare & Biotechnology',
    keywords: ['biotech', 'pharmaceutical', 'drug', 'clinical trial', 'fda', 'genomics', 'crispr', 'mrna', 'vaccine', 'therapeutic'],
    sectorHints: ['Healthcare', 'Biotechnology', 'Pharmaceuticals'],
    description: 'Biotechnology and pharmaceutical companies',
  },
  {
    id: 'medtech',
    name: 'Medical Technology',
    keywords: ['medical device', 'medtech', 'diagnostic', 'imaging', 'surgical robot', 'wearable health', 'telehealth', 'digital health'],
    sectorHints: ['Healthcare', 'Medical Devices'],
    description: 'Medical device and healthcare technology companies',
  },
  {
    id: 'clean-energy',
    name: 'Clean Energy & Renewables',
    keywords: ['solar', 'wind', 'renewable', 'clean energy', 'green energy', 'hydrogen', 'fuel cell', 'geothermal', 'hydroelectric'],
    sectorHints: ['Utilities', 'Energy', 'Industrials'],
    description: 'Renewable energy generation and technology companies',
  },
  {
    id: 'ev-battery',
    name: 'Electric Vehicles & Battery Technology',
    keywords: ['electric vehicle', 'ev', 'battery', 'lithium', 'charging', 'autonomous', 'tesla', 'byd', 'solid state'],
    sectorHints: ['Consumer Discretionary', 'Industrials', 'Materials'],
    description: 'Electric vehicle manufacturers and battery technology',
  },
  {
    id: 'esg-sustainability',
    name: 'ESG & Sustainability',
    keywords: ['esg', 'sustainable', 'green', 'carbon', 'climate', 'environmental', 'social responsibility', 'governance', 'net zero'],
    sectorHints: [],
    description: 'Companies with strong ESG focus or sustainability mandates',
  },
  {
    id: 'robotics-automation',
    name: 'Robotics & Industrial Automation',
    keywords: ['robot', 'automation', 'industrial automation', 'cobot', 'manufacturing automation', 'warehouse automation'],
    sectorHints: ['Industrials', 'Technology', 'Information Technology'],
    description: 'Robotics and industrial automation companies',
  },
  {
    id: 'space-defense',
    name: 'Space & Defense',
    keywords: ['space', 'satellite', 'defense', 'aerospace', 'military', 'rocket', 'missile', 'drone', 'uav'],
    sectorHints: ['Industrials', 'Aerospace & Defense'],
    description: 'Space exploration and defense contractors',
  },
  {
    id: 'gaming-esports',
    name: 'Gaming & Esports',
    keywords: ['gaming', 'video game', 'esports', 'game publisher', 'game console', 'mobile gaming', 'metaverse'],
    sectorHints: ['Communication Services', 'Consumer Discretionary'],
    description: 'Video game and esports companies',
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce & Digital Retail',
    keywords: ['ecommerce', 'e-commerce', 'online retail', 'marketplace', 'digital commerce', 'amazon', 'shopify'],
    sectorHints: ['Consumer Discretionary', 'Technology'],
    description: 'Online retail and e-commerce platform companies',
  },
  {
    id: 'telecom-5g',
    name: 'Telecommunications & 5G',
    keywords: ['5g', 'telecom', 'telecommunications', 'wireless', 'network infrastructure', 'fiber optic', 'tower'],
    sectorHints: ['Communication Services', 'Telecommunication Services'],
    description: 'Telecommunications and 5G infrastructure companies',
  },
  {
    id: 'real-estate-reit',
    name: 'Real Estate & REITs',
    keywords: ['reit', 'real estate', 'property', 'commercial real estate', 'residential', 'industrial reit', 'data center reit'],
    sectorHints: ['Real Estate', 'REITs'],
    description: 'Real estate investment trusts and property companies',
  },
  {
    id: 'commodities-materials',
    name: 'Commodities & Basic Materials',
    keywords: ['commodity', 'mining', 'gold', 'silver', 'copper', 'oil', 'gas', 'natural resources', 'rare earth'],
    sectorHints: ['Materials', 'Energy', 'Basic Materials'],
    description: 'Commodity producers and basic materials companies',
  },
  {
    id: 'consumer-staples',
    name: 'Consumer Staples & Packaged Goods',
    keywords: ['consumer staples', 'food', 'beverage', 'household', 'personal care', 'packaged goods', 'grocery'],
    sectorHints: ['Consumer Staples', 'Consumer Defensive'],
    description: 'Essential consumer goods and staples companies',
  },
  {
    id: 'banking-financial',
    name: 'Banking & Financial Services',
    keywords: ['bank', 'banking', 'financial services', 'insurance', 'asset management', 'wealth management', 'investment bank'],
    sectorHints: ['Financials', 'Financial Services'],
    description: 'Traditional banking and financial services',
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure & Construction',
    keywords: ['infrastructure', 'construction', 'engineering', 'building', 'civil engineering', 'utilities', 'water', 'waste'],
    sectorHints: ['Industrials', 'Utilities', 'Materials'],
    description: 'Infrastructure development and construction companies',
  },
];

export const TOPIC_LABELS = [
  'FDA Regulation',
  'AI Chip Export Controls',
  'Interest Rate Decision',
  'Earnings Report',
  'Merger & Acquisition',
  'Clinical Trial Results',
  'Product Launch',
  'Executive Changes',
  'Supply Chain Issues',
  'Antitrust Investigation',
  'Trade Policy',
  'Economic Data',
  'Geopolitical Risk',
  'Climate Policy',
  'Data Privacy',
  'Labor Market',
  'Energy Prices',
  'Currency Movement',
  'IPO/SPAC',
  'Bankruptcy/Restructuring',
];

export function classifyHolding(
  holdingName: string,
  holdingTicker: string,
  sector?: string | null,
  industry?: string | null
): { themeId: string; confidence: number }[] {
  const results: { themeId: string; confidence: number }[] = [];
  const searchText = `${holdingName} ${holdingTicker} ${sector || ''} ${industry || ''}`.toLowerCase();

  for (const theme of THEME_TAXONOMY) {
    let score = 0;
    let matches = 0;

    // Check keyword matches
    for (const keyword of theme.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        score += 0.3;
        matches++;
      }
    }

    // Check sector hints
    if (sector) {
      for (const hint of theme.sectorHints) {
        if (sector.toLowerCase().includes(hint.toLowerCase())) {
          score += 0.2;
          matches++;
        }
      }
    }

    // Check industry
    if (industry) {
      for (const hint of theme.sectorHints) {
        if (industry.toLowerCase().includes(hint.toLowerCase())) {
          score += 0.15;
          matches++;
        }
      }
    }

    // Normalize confidence to 0-1
    const confidence = Math.min(score, 1);

    if (confidence >= 0.15 && matches > 0) {
      results.push({ themeId: theme.id, confidence });
    }
  }

  // Sort by confidence and return top 3
  return results
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

export function getThemeById(themeId: string): Theme | undefined {
  return THEME_TAXONOMY.find((t) => t.id === themeId);
}

export function searchThemes(query: string): Theme[] {
  const q = query.toLowerCase();
  return THEME_TAXONOMY.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.toLowerCase().includes(q))
  );
}
