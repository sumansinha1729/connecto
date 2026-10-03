import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useState } from 'react';

import { adminApi } from '../api/admin';
import type { Period } from '../api/types';
import { Chart } from '../components/charts';
import { Card, ErrorBox, Loading, PageHeader, Stat, Tabs } from '../components/ui';
import { formatNumber, formatRupees } from '../lib/format';
import { PERIODS } from './Activity';

export function MoneyPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const metrics = useQuery({ queryKey: ['metrics', period], queryFn: () => adminApi.metrics(period), refetchInterval: 60_000 });

  return (
    <>
      <PageHeader title="Money" subtitle="Coins in and out, what listeners earned, and payouts." right={<Tabs value={period} options={PERIODS} onChange={setPeriod} />} />
      {metrics.isPending ? (
        <Loading />
      ) : metrics.isError ? (
        <ErrorBox error={metrics.error} onRetry={() => metrics.refetch()} />
      ) : (
        (() => {
          const { totals: t, series, pricing, period: p } = metrics.data;
          const hourly = p === 'today';
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <Stat label="Collected from coin sales" value={formatRupees(t.rechargeInr * 100)} tone="success" hint={`${formatNumber(t.coinsBought)} coins bought`} />
                <Stat label="Coins spent on calls" value={formatNumber(t.coinsSpent)} tone="warning" hint={`${pricing.callRateCoinsPerMin} coins per minute`} />
                <Stat
                  label="Listeners earned"
                  value={formatRupees(t.listenerEarningsPaise)}
                  hint={`${formatRupees(pricing.listenerEarningPaisePerMin)} per minute`}
                />
                <Stat label="Payouts sent" value={formatRupees(t.payoutsPaidPaise)} hint={`${formatNumber(t.payoutsPaidCount)} withdrawals marked paid`} />
                <Stat
                  label="Payouts waiting"
                  value={formatRupees(t.payoutsPendingPaise)}
                  tone={t.payoutsPendingCount ? 'warning' : 'default'}
                  hint={`${formatNumber(t.payoutsPendingCount)} requests (all time)`}
                  to="/payouts"
                />
                <Stat label="Minutes talked" value={formatNumber(t.minutes)} hint={`${formatNumber(t.calls)} calls`} />
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted">
                <Info size={14} className="mt-0.5 shrink-0" />
                Only real payments count as money collected. The test “recharge” button in the app adds coins but no rupees, so this stays at ₹0 until
                payments are connected.
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Chart
                  title="Coins"
                  subtitle={hourly ? 'per hour' : 'per day'}
                  data={series}
                  x="key"
                  series={[
                    { key: 'coinsBought', label: 'Bought', color: '#22c55e' },
                    { key: 'coinsSpent', label: 'Spent on calls', color: '#fbbf24' },
                  ]}
                />
                <Chart
                  title="Listener earnings"
                  subtitle={hourly ? 'per hour' : 'per day'}
                  data={series}
                  x="key"
                  kind="area"
                  format={(paise) => formatRupees(paise)}
                  series={[{ key: 'listenerEarningsPaise', label: 'Earned', color: '#8b5cf6' }]}
                />
                <Chart
                  title="Collected from coin sales"
                  subtitle={hourly ? 'per hour' : 'per day'}
                  data={series}
                  x="key"
                  format={(inr) => `₹${inr.toLocaleString('en-IN')}`}
                  series={[{ key: 'rechargeInr', label: '₹ collected', color: '#22c55e' }]}
                />
                <Card title="How the money works">
                  <ul className="space-y-2 text-sm text-muted">
                    <li>
                      Users buy coins, and each call minute costs <span className="text-text">{pricing.callRateCoinsPerMin} coins</span>.
                    </li>
                    <li>
                      The listener earns <span className="text-text">{formatRupees(pricing.listenerEarningPaisePerMin)}</span> for every minute, into their ₹
                      earnings.
                    </li>
                    <li>Listeners withdraw from ₹500. Payouts are sent by your team and marked paid on the Payouts page.</li>
                  </ul>
                </Card>
              </div>
            </div>
          );
        })()
      )}
    </>
  );
}
