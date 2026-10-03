import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Headphones, Mic, PhoneCall, PhoneIncoming, Radio, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';

import { adminApi } from '../api/admin';
import { askConfirm } from '../components/dialogs';
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader, PersonCell, Stat, Table, Td } from '../components/ui';
import { formatDuration, formatNumber, formatRupees, timeAgo } from '../lib/format';
import { useAction } from '../lib/hooks';

/** Re-renders every second so call timers keep ticking between refreshes */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function LivePage() {
  const now = useNow();
  const live = useQuery({ queryKey: ['live'], queryFn: adminApi.live, refetchInterval: 5_000 });
  const today = useQuery({ queryKey: ['metrics', 'today'], queryFn: () => adminApi.metrics('today'), refetchInterval: 60_000 });
  const stats = useQuery({ queryKey: ['stats'], queryFn: adminApi.stats, refetchInterval: 30_000 });
  const { busy, run } = useAction();

  if (live.isPending) return <Loading />;
  if (live.isError) return <ErrorBox error={live.error} onRetry={() => live.refetch()} />;
  const { people, calls, ringing, rooms } = live.data;
  const t = today.data?.totals;

  const endRoom = async (id: string, title: string) => {
    if (await askConfirm({ title: `End “${title}”?`, message: 'Everyone in the room is disconnected right away.', confirmText: 'End room', destructive: true })) {
      await run(`room:${id}`, () => adminApi.endRoom(id), 'Room ended');
    }
  };

  return (
    <>
      <PageHeader
        title="Live now"
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            Updates every 5 seconds
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Users online" value={formatNumber(people.usersOnline)} icon={<UserRound size={15} />} />
        <Stat label="Listeners online" value={formatNumber(people.listenersOnline)} icon={<Headphones size={15} />} />
        <Stat label="Free to take calls" value={formatNumber(people.listenersAvailable)} tone="success" hint="Online, available, not in a call" />
        <Stat label="Calls in progress" value={formatNumber(calls.length)} tone="primary" icon={<PhoneCall size={15} />} />
        <Stat label="Ringing" value={formatNumber(ringing.length)} icon={<PhoneIncoming size={15} />} />
        <Stat label="Live rooms" value={formatNumber(rooms.length)} icon={<Radio size={15} />} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Calls today" value={t ? formatNumber(t.calls) : '…'} hint={t?.answerRate != null ? `${t.answerRate}% answered` : undefined} />
        <Stat label="Minutes today" value={t ? formatNumber(t.minutes) : '…'} hint={t ? `avg ${t.avgCallMinutes} min per call` : undefined} />
        <Stat label="Coins spent today" value={t ? formatNumber(t.coinsSpent) : '…'} tone="warning" />
        <Stat label="Listeners earned today" value={t ? formatRupees(t.listenerEarningsPaise) : '…'} tone="success" />
        <Stat label="New sign-ups today" value={t ? formatNumber(t.signups) : '…'} />
      </div>

      {stats.data && (stats.data.listeners.pendingApplications > 0 || stats.data.payouts.pending > 0 || stats.data.reports.open > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {stats.data.listeners.pendingApplications > 0 && (
            <Stat label="Waiting: applications" value={stats.data.listeners.pendingApplications} tone="warning" hint="Review →" to="/applications" />
          )}
          {stats.data.payouts.pending > 0 && (
            <Stat
              label="Waiting: payouts"
              value={stats.data.payouts.pending}
              tone="warning"
              hint={`${formatRupees(stats.data.payouts.pendingPaise)} to pay →`}
              to="/payouts"
            />
          )}
          {stats.data.reports.open > 0 && <Stat label="Waiting: reports" value={stats.data.reports.open} tone="danger" hint="Review →" to="/reports" />}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card title={`Calls in progress · ${calls.length}`} className="xl:col-span-3">
          {calls.length === 0 ? (
            <Empty title="No calls right now" hint="Calls show up here the moment a listener picks up." />
          ) : (
            <Table head={['User', '', 'Listener', 'Duration', 'Coins', 'Listener earned']}>
              {calls.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <PersonCell person={c.caller} />
                  </Td>
                  <Td className="text-faint">
                    <ArrowRight size={14} />
                  </Td>
                  <Td>
                    <PersonCell person={c.listener} />
                  </Td>
                  <Td className="tabular font-medium">{formatDuration((now - new Date(c.startedAt).getTime()) / 1000)}</Td>
                  <Td className="tabular">{formatNumber(c.coins)}</Td>
                  <Td className="tabular text-success">{formatRupees(c.earnedPaise)}</Td>
                </tr>
              ))}
            </Table>
          )}
          {ringing.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="mb-2 text-xs font-semibold tracking-wide text-faint uppercase">Ringing</div>
              <div className="space-y-2">
                {ringing.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 text-sm">
                    <PersonCell person={c.caller} showPhone={false} />
                    <ArrowRight size={14} className="text-faint" />
                    <PersonCell person={c.listener} showPhone={false} />
                    <span className="ml-auto text-xs text-faint">{formatDuration((now - new Date(c.startedAt).getTime()) / 1000)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title={`Live rooms · ${rooms.length}`} className="xl:col-span-2">
          {rooms.length === 0 ? (
            <Empty title="No live rooms" hint="Listeners can start voice rooms from the app." />
          ) : (
            <div className="space-y-3">
              {rooms.map((r) => (
                <div key={r.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.title}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge tone="primary">{r.topic}</Badge>
                        <Badge>{r.language}</Badge>
                        <Badge>
                          <Mic size={11} /> {r.speakers} on stage · {r.participants} in room
                        </Badge>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" loading={busy === `room:${r.id}`} onClick={() => endRoom(r.id, r.title)}>
                      End
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-faint">
                    <PersonCell person={r.host} showPhone={false} />
                    started {timeAgo(r.startedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
