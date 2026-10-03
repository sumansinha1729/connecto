import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { adminApi } from '../api/admin';
import type { AuditEntry } from '../api/types';
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, PersonCell, Table, Td } from '../components/ui';
import { formatDateTime, formatRupees } from '../lib/format';

/** "approved Lata's listener application", "added 50 coins to Uday (Refund)" … */
export function describeAction(a: AuditEntry): string {
  const who = a.target?.name || 'someone';
  const d = a.details as Record<string, string | number | undefined>;
  switch (a.action) {
    case 'approve_listener':
      return `approved ${who} as a listener`;
    case 'reject_listener':
      return `rejected ${who}’s listener application${d.note ? ` (${d.note})` : ''}`;
    case 'revoke_listener':
      return `removed ${who}’s listener rights${d.note ? ` (${d.note})` : ''}`;
    case 'ban_user':
      return `banned ${who}${d.reason ? ` (${d.reason})` : ''}`;
    case 'unban_user':
      return `unbanned ${who}`;
    case 'adjust_wallet': {
      const amount = Number(d.amount ?? 0);
      return `${amount > 0 ? 'added' : 'removed'} ${Math.abs(amount)} coins ${amount > 0 ? 'to' : 'from'} ${who}${d.reason ? ` (${d.reason})` : ''}`;
    }
    case 'resolve_report':
      return `resolved a report about ${who}${d.status ? ` as ${d.status}` : ''}`;
    case 'end_room':
      return `ended a room hosted by ${who}`;
    case 'mark_payout_paid':
      return `paid ${formatRupees(Number(d.amountPaise ?? 0))} to ${who}${d.reference ? ` (ref ${d.reference})` : ''}`;
    case 'reject_payout':
      return `rejected ${who}’s withdrawal of ${formatRupees(Number(d.amountPaise ?? 0))}`;
    default:
      return `${a.action.replace(/_/g, ' ')} · ${who}`;
  }
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const log = useQuery({ queryKey: ['audit', page], queryFn: () => adminApi.auditLog(page) });

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every action taken by an admin, newest first." />
      {log.isPending ? (
        <Loading />
      ) : log.isError ? (
        <ErrorBox error={log.error} onRetry={() => log.refetch()} />
      ) : (
        <Card>
          {log.data.actions.length === 0 ? (
            <Empty title="Nothing here yet" />
          ) : (
            <Table head={['When', 'Admin', 'Action', 'About']}>
              {log.data.actions.map((a) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(a.createdAt)}</Td>
                  <Td>
                    <PersonCell person={a.admin} showPhone={false} />
                  </Td>
                  <Td>{describeAction(a)}</Td>
                  <Td>{a.target ? <PersonCell person={a.target} showPhone={false} /> : <span className="text-faint">—</span>}</Td>
                </tr>
              ))}
            </Table>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Newer
            </Button>
            <span className="tabular text-xs text-faint">Page {page}</span>
            <Button size="sm" disabled={log.data.actions.length < 50} onClick={() => setPage(page + 1)}>
              Older
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
