import { useQuery } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { useState } from 'react';

import { adminApi } from '../api/admin';
import type { AdminPayout } from '../api/types';
import { askForm, toast } from '../components/dialogs';
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader, PersonCell, Table, Tabs, Td } from '../components/ui';
import { formatDateTime, formatRupees, timeAgo } from '../lib/format';
import { useAction } from '../lib/hooks';

type Status = 'requested' | 'paid' | 'rejected';

function CopyValue({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-faint">{label}</span>
      <span className="tabular font-medium">{value}</span>
      <button
        className="rounded p-0.5 text-faint hover:text-text"
        title={`Copy ${label}`}
        onClick={() => navigator.clipboard.writeText(value).then(() => toast(`${label} copied`))}
      >
        <Copy size={12} />
      </button>
    </div>
  );
}

export function PayoutsPage() {
  const [status, setStatus] = useState<Status>('requested');
  const list = useQuery({ queryKey: ['payouts', status], queryFn: () => adminApi.payouts(status), refetchInterval: 30_000 });
  const { busy, run } = useAction();

  const total = list.data?.payouts.reduce((sum, p) => sum + p.amountPaise, 0) ?? 0;

  const markPaid = async (p: AdminPayout) => {
    const values = await askForm({
      title: `Mark ${formatRupees(p.amountPaise)} to ${p.listener?.name ?? 'listener'} as paid?`,
      message: 'First send the money from your bank or UPI app, then enter its reference number here.',
      confirmText: 'Mark as paid',
      fields: [{ name: 'reference', label: 'UTR / transaction reference', minLength: 4, placeholder: 'e.g. 412345678901' }],
    });
    if (values) await run(`pay:${p.id}`, () => adminApi.markPaid(p.id, String(values.reference).trim()), 'Marked as paid');
  };

  const reject = async (p: AdminPayout) => {
    const values = await askForm({
      title: 'Reject this withdrawal?',
      message: 'The money goes back to the listener’s earnings balance, and they see your reason.',
      confirmText: 'Reject',
      destructive: true,
      fields: [{ name: 'note', label: 'Reason', type: 'textarea', minLength: 3, placeholder: 'e.g. UPI ID is not active' }],
    });
    if (values) await run(`reject:${p.id}`, () => adminApi.rejectPayout(p.id, String(values.note).trim()), 'Withdrawal rejected, money returned');
  };

  return (
    <>
      <PageHeader
        title="Payouts"
        subtitle={status === 'requested' && list.data?.payouts.length ? `${list.data.payouts.length} waiting · ${formatRupees(total)} to send` : 'Listener withdrawals'}
        right={
          <Tabs
            value={status}
            onChange={setStatus}
            options={[
              { value: 'requested', label: 'To pay' },
              { value: 'paid', label: 'Paid' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        }
      />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <Card>
          {list.data.payouts.length === 0 ? (
            <Empty title={status === 'requested' ? 'Nothing to pay right now' : 'Nothing here'} />
          ) : (
            <Table head={['Listener', 'Amount', 'Send to', status === 'requested' ? 'Requested' : 'Processed', '']}>
              {list.data.payouts.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <PersonCell person={p.listener} />
                  </Td>
                  <Td className="tabular text-base font-semibold">{formatRupees(p.amountPaise)}</Td>
                  <Td className="text-xs">
                    <Badge tone="primary">{p.method.kind === 'upi' ? 'UPI' : 'Bank'}</Badge>
                    <div className="mt-1.5 space-y-0.5">
                      <CopyValue label="Name" value={p.method.accountName} />
                      <CopyValue label="UPI" value={p.method.upiId} />
                      <CopyValue label="A/c" value={p.method.accountNumber} />
                      <CopyValue label="IFSC" value={p.method.ifsc} />
                    </div>
                  </Td>
                  <Td className="text-muted">
                    {status === 'requested' ? (
                      timeAgo(p.createdAt)
                    ) : (
                      <>
                        {formatDateTime(p.processedAt)}
                        {p.reference && <div className="tabular text-xs text-faint">Ref {p.reference}</div>}
                        {p.note && <div className="text-xs text-faint">{p.note}</div>}
                      </>
                    )}
                  </Td>
                  <Td className="text-right">
                    {status === 'requested' && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => reject(p)} loading={busy === `reject:${p.id}`}>
                          Reject
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => markPaid(p)} loading={busy === `pay:${p.id}`}>
                          Mark paid
                        </Button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
