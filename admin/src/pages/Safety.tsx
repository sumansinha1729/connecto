import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { Link } from 'react-router';

import { adminApi } from '../api/admin';
import { Chart } from '../components/charts';
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, PersonCell, Stat, Table, Td } from '../components/ui';
import { formatNumber, timeAgo, titleCase } from '../lib/format';
import { describeAction } from './Audit';

export function SafetyPage() {
  const safety = useQuery({ queryKey: ['safety'], queryFn: adminApi.safety, refetchInterval: 60_000 });

  if (safety.isPending) return <Loading />;
  if (safety.isError) return <ErrorBox error={safety.error} onRetry={() => safety.refetch()} />;
  const s = safety.data;

  return (
    <>
      <PageHeader title="Safety" subtitle="Reports, suspicious patterns and what the team has done." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open reports" value={formatNumber(s.openReports)} tone={s.openReports ? 'danger' : 'success'} to="/reports" hint="Review →" />
        <Stat label="People with 2+ open reports" value={formatNumber(s.mostReported.length)} tone={s.mostReported.length ? 'warning' : 'default'} />
        <Stat label="Listeners ending calls instantly" value={formatNumber(s.shortCallListeners.length)} tone={s.shortCallListeners.length ? 'warning' : 'default'} hint="Last 7 days" />
        <Stat label="Low-rated listeners" value={formatNumber(s.lowRatedListeners.length)} tone={s.lowRatedListeners.length ? 'warning' : 'default'} hint="Below 3★ with 5+ ratings" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Most reported" right={<span className="text-xs text-faint">open reports only</span>}>
          {s.mostReported.length === 0 ? (
            <Empty title="Nobody has several open reports" />
          ) : (
            <Table head={['Person', 'Open reports', 'Last report']}>
              {s.mostReported.map((r, i) => (
                <tr key={r.user?.id ?? i}>
                  <Td>
                    <PersonCell person={r.user} />
                  </Td>
                  <Td>
                    <Badge tone="danger">{r.openReports}</Badge>
                  </Td>
                  <Td className="text-muted">{timeAgo(r.lastReportAt)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card
          title="Listeners ending calls within seconds"
          right={<span className="text-xs text-faint">they still earn the first minute</span>}
        >
          {s.shortCallListeners.length === 0 ? (
            <Empty title="No suspicious short calls" hint="Listed when a listener hangs up 3+ calls within 30 seconds in a week." />
          ) : (
            <Table head={['Listener', 'Short calls', 'Of all calls']}>
              {s.shortCallListeners.map((r, i) => (
                <tr key={r.listener?.id ?? i}>
                  <Td>
                    <PersonCell person={r.listener} />
                  </Td>
                  <Td className="tabular">
                    {r.shortCalls} / {r.calls}
                  </Td>
                  <Td>
                    <Badge tone={r.shortSharePct >= 50 ? 'danger' : 'warning'}>{r.shortSharePct}%</Badge>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Chart
          title="Report reasons"
          subtitle="last 7 days"
          data={s.reportsThisWeek.map((r) => ({ reason: titleCase(r.reason), count: r.count }))}
          x="reason"
          series={[{ key: 'count', label: 'Reports', color: '#ef4444' }]}
        />

        <Card title="Low-rated listeners">
          {s.lowRatedListeners.length === 0 ? (
            <Empty title="No low-rated listeners" />
          ) : (
            <Table head={['Listener', 'Rating']}>
              {s.lowRatedListeners.map((r, i) => (
                <tr key={r.listener?.id ?? i}>
                  <Td>
                    <PersonCell person={r.listener} />
                  </Td>
                  <Td className="tabular">
                    <span className="inline-flex items-center gap-1">
                      <Star size={13} className="fill-coin text-coin" /> {r.rating.toFixed(1)} <span className="text-faint">({r.ratingCount})</span>
                    </span>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Recent bans">
          {s.recentBans.length === 0 ? (
            <Empty title="No banned accounts" />
          ) : (
            <Table head={['Person', 'Reason', 'When']}>
              {s.recentBans.map((b, i) => (
                <tr key={b.user?.id ?? i}>
                  <Td>
                    <PersonCell person={b.user} />
                  </Td>
                  <Td className="max-w-xs truncate text-muted">{b.reason ?? '—'}</Td>
                  <Td className="text-muted">{timeAgo(b.bannedAt)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Recent admin actions" right={<Link to="/audit" className="text-xs text-primary hover:underline">Full log →</Link>}>
          {s.recentAdminActions.length === 0 ? (
            <Empty title="No admin actions yet" />
          ) : (
            <ul className="space-y-3 text-sm">
              {s.recentAdminActions.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="font-medium">{a.admin?.name ?? 'Admin'}</span> <span className="text-muted">{describeAction(a)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-faint">{timeAgo(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
