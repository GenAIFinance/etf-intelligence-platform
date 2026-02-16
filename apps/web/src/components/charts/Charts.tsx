'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatPercent, formatNumber, formatDate } from '@/lib/utils';

interface PriceChartProps {
  data: { date: string; close: number; adjustedClose: number }[];
  range: string;
}

export function PriceChart({ data, range }: PriceChartProps) {
  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    price: d.adjustedClose,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          tickFormatter={(v) => `$${v.toFixed(0)}`}
          domain={['auto', 'auto']}
        />
        <Tooltip
          formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
          labelStyle={{ fontWeight: 'bold' }}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface ReturnsChartProps {
  returns: {
    '1M': number | null;
    '3M': number | null;
    '6M': number | null;
    '1Y': number | null;
    '3Y': number | null;
    '5Y': number | null;
    'YTD': number | null;
  };
}

export function ReturnsChart({ returns }: ReturnsChartProps) {
  const data = [
    { period: '1M', return: returns['1M'] },
    { period: '3M', return: returns['3M'] },
    { period: '6M', return: returns['6M'] },
    { period: 'YTD', return: returns['YTD'] },
    { period: '1Y', return: returns['1Y'] },
    { period: '3Y', return: returns['3Y'] },
    { period: '5Y', return: returns['5Y'] },
  ].filter((d) => d.return !== null);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="period" tick={{ fontSize: 12 }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          tickFormatter={(v) => formatPercent(v, 0)}
        />
        <Tooltip
          formatter={(value: number) => [formatPercent(value), 'Return']}
        />
        <Bar
          dataKey="return"
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={(entry.return ?? 0) >= 0 ? '#22c55e' : '#ef4444'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface SectorChartProps {
  sectors: { sector: string; weight: number }[];
}

const COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#16a34a',
  '#0891b2',
  '#4f46e5',
  '#be185d',
  '#c2410c',
  '#15803d',
  '#0d9488',
];

export function SectorChart({ sectors }: SectorChartProps) {
  const data = sectors.slice(0, 10).map((s, i) => ({
    name: s.sector,
    value: s.weight * 100,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Weight']} />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface ThemeExposureChartProps {
  exposures: { themeName: string; exposure: number }[];
}

export function ThemeExposureChart({ exposures }: ThemeExposureChartProps) {
  const data = exposures.slice(0, 10).map((e) => ({
    name: e.themeName.length > 20 ? e.themeName.slice(0, 20) + '...' : e.themeName,
    exposure: e.exposure * 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          type="number"
          tick={{ fontSize: 12 }}
          tickLine={false}
          tickFormatter={(v) => `${v.toFixed(0)}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          tickLine={false}
          width={150}
        />
        <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Exposure']} />
        <Bar dataKey="exposure" fill="#7c3aed" />
      </BarChart>
    </ResponsiveContainer>
  );
}
