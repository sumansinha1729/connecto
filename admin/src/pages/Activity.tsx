import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { useState } from 'react';

import { adminApi } from '../api/admin';
import type { Period } from '../api/types';
import { Chart } from '../components/charts';
import { Card, Empty, ErrorBox, Loading, PageHeader, PersonCell, Stat, Table, Tabs, Td } from '../components/ui';
import { formatNumber, formatRupees } from '../lib/format';

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

export function ActivityPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const metrics = useQuery({ queryKey: ['metrics', period], queryFn: () => adminApi.metrics(period), refetchInterval: 60_000 });

  return (
    <>
      <PageHeader title="Activity" subtitle="Sign-ups, calls and the busiest times. Days and hours are India time." right={<Tabs value={period} options={PERIODS} onChange={setPeriod} />} />
      {metrics.isPending ? (
        <Loading />
      ) : metrics.isError ? (
        <ErrorBox error={metrics.error} onRetry={() => metrics.refetch()} />
      ) : (
        <ActivityBody data={metrics.data} />
      )}
    </>
  );
}

function ActivityBody({ data }: { data: NonNullable<Awaited<ReturnType<typeof adminApi.metrics>>> }) {
  const t = data.totals;
  const hourly = data.period === 'today';
  const missed = data.series.reduce((n, b) => n + b.missedCalls, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="New sign-ups" value={formatNumber(t.signups)} />
        <Stat label="Calls" value={formatNumber(t.calls)} tone="primary" />
        <Stat label="Minutes talked" value={formatNumber(t.minutes)} />
        <Stat label="Avg call length" value={`${t.avgCallMinutes} min`} />
        <Stat label="Answer rate" value={t.answerRate == null ? '—' : `${t.answerRate}%`} tone={t.answerRate != null && t.answerRate < 70 ? 'warning' : 'success'} hint="Calls picked up" />
        <Stat label="Missed or declined" value={formatNumber(missed)} tone={missed ? 'warning' : 'default'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Chart
          title="Calls"
          subtitle={hourly ? 'per hour' : 'per day'}
          data={data.series}
          x="key"
          stacked
          series={[
            { key: 'calls', label: 'Answered', color: '#8b5cf6' },
            { key: 'missedCalls', label: 'Missed / declined', color: '#f59e0b' },
          ]}
        />
        <Chart title="Minutes talked" subtitle={hourly ? 'per hour' : 'per day'} data={data.series} x="key" kind="area" series={[{ key: 'minutes', label: 'Minutes', color: '#22c55e' }]} />
        <Chart title="New sign-ups" subtitle={hourly ? 'per hour' : 'per day'} data={data.series} x="key" series={[{ key: 'signups', label: 'Sign-ups', color: '#ec4899' }]} />
        <Chart
          title="Busiest hours"
          subtitle="calls by hour of day"
          data={data.busiestHours}
          x="hour"
          xLabel={(h) => {
            const n = Number(h);
            return n === 0 ? '12a' : n < 12 ? `${n}a` : n === 12 ? '12p' : `${n - 12}p`;
          }}
          series={[{ key: 'calls', label: 'Calls', color: '#8b5cf6' }]}
        />
      </div>

      <Card title="Top listeners" right={<span className="text-xs text-faint">by minutes talked</span>}>
        {data.topListeners.length === 0 ? (
          <Empty title="No calls in this period" />
        ) : (
          <Table head={['#', 'Listener', 'Calls', 'Minutes', 'Earned', 'Rating']}>
            {data.topListeners.map((row, i) => (
              <tr key={row.listener?.id ?? i}>
                <Td className="tabular text-faint">{i + 1}</Td>
                <Td>
                  <PersonCell person={row.listener} />
                </Td>
                <Td className="tabular">{formatNumber(row.calls)}</Td>
                <Td className="tabular font-medium">{formatNumber(row.minutes)}</Td>
                <Td className="tabular text-success">{formatRupees(row.earningsPaise)}</Td>
                <Td className="tabular">
                  {row.ratingCount ? (
                    <span className="inline-flex items-center gap-1">
                      <Star size={13} className="fill-coin text-coin" /> {row.rating.toFixed(1)} <span className="text-faint">({row.ratingCount})</span>
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
