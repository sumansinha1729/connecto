import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { bucketLabel } from '../lib/format';
import { Card } from './ui';

const AXIS = { stroke: '#6e6893', fontSize: 11, tickLine: false, axisLine: false } as const;
const TOOLTIP = {
  contentStyle: { background: '#241d40', border: '1px solid #2f2752', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#f5f3ff', marginBottom: 4 },
  cursor: { fill: 'rgba(139, 92, 246, 0.08)' },
};

interface Series {
  key: string;
  label: string;
  color: string;
}

interface ChartProps {
  title: string;
  subtitle?: string;
  data: object[];
  /** Field used for the x axis; "key" buckets are turned into "2 PM" / "3 Oct" */
  x: string;
  series: Series[];
  kind?: 'bar' | 'area';
  stacked?: boolean;
  format?: (value: number) => string;
  xLabel?: (value: string | number) => string;
}

export function Chart({ title, subtitle, data, x, series, kind = 'bar', stacked, format, xLabel }: ChartProps) {
  const tickX = xLabel ?? ((v: string | number) => (x === 'key' ? bucketLabel(String(v)) : String(v)));
  const tooltip = {
    ...TOOLTIP,
    labelFormatter: (v: unknown) => tickX(v as string),
    formatter: (value: unknown, name: unknown) => [format ? format(Number(value)) : Number(value).toLocaleString('en-IN'), String(name)],
  };
  const common = { data, margin: { top: 8, right: 8, left: -12, bottom: 0 } };
  const axes = (
    <>
      <CartesianGrid stroke="#2f2752" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={x} tickFormatter={tickX} {...AXIS} minTickGap={16} />
      <YAxis {...AXIS} allowDecimals={false} tickFormatter={(v: number) => (format ? format(v) : v.toLocaleString('en-IN'))} width={56} />
      <Tooltip {...tooltip} />
    </>
  );

  return (
    <Card
      title={
        <span>
          {title}
          {subtitle && <span className="ml-2 font-normal text-faint">{subtitle}</span>}
        </span>
      }
      right={
        series.length > 1 && (
          <div className="flex gap-3 text-xs text-muted">
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        )
      }
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {kind === 'area' ? (
            <AreaChart {...common}>
              {axes}
              {series.map((s) => (
                <Area key={s.key} dataKey={s.key} name={s.label} type="monotone" stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={2} />
              ))}
            </AreaChart>
          ) : (
            <BarChart {...common}>
              {axes}
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  stackId={stacked ? 'stack' : undefined}
                  radius={stacked && i < series.length - 1 ? 0 : [4, 4, 0, 0]}
                  maxBarSize={36}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
