import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { adminApi } from '../api/admin';
import type { AdminReport } from '../api/types';
import { askForm } from '../components/dialogs';
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader, PersonCell, Tabs } from '../components/ui';
import { timeAgo, titleCase } from '../lib/format';
import { useAction } from '../lib/hooks';

type Status = 'open' | 'reviewed' | 'actioned';

export function ReportsPage() {
  const [status, setStatus] = useState<Status>('open');
  const list = useQuery({ queryKey: ['reports', status], queryFn: () => adminApi.reports(status), refetchInterval: 30_000 });

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="What users reported about each other. Reports are anonymous to the person reported."
        right={
          <Tabs
            value={status}
            onChange={setStatus}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'reviewed', label: 'Dismissed' },
              { value: 'actioned', label: 'Action taken' },
            ]}
          />
        }
      />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.reports.length === 0 ? (
        <Card>
          <Empty title={status === 'open' ? 'No open reports' : 'Nothing here'} />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.data.reports.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </div>
      )}
    </>
  );
}

function ReportRow({ report: r }: { report: AdminReport }) {
  const { busy, run } = useAction();

  const dismiss = async () => {
    const values = await askForm({
      title: 'Dismiss this report?',
      message: 'Use this when nothing needs to be done.',
      confirmText: 'Dismiss',
      fields: [{ name: 'note', label: 'Note (optional)', type: 'textarea' }],
    });
    if (values) await run('dismiss', () => adminApi.resolveReport(r.id, { status: 'reviewed', note: String(values.note).trim() || undefined }), 'Report dismissed');
  };

  const act = async () => {
    const values = await askForm({
      title: `Take action on ${r.reported?.name ?? 'this user'}?`,
      message: 'Write what you did. Banning logs them out at once, ends any call they are in and stops them logging in again.',
      confirmText: 'Save',
      destructive: true,
      fields: [
        { name: 'note', label: 'What was done', type: 'textarea', minLength: 3, placeholder: 'e.g. Warned the user' },
        { name: 'ban', label: `Also ban ${r.reported?.name ?? 'this user'}`, type: 'checkbox' },
      ],
    });
    if (values) {
      await run('act', () => adminApi.resolveReport(r.id, { status: 'actioned', note: String(values.note).trim(), ban: Boolean(values.ban) }), values.ban ? 'User banned' : 'Saved');
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="min-w-48">
          <div className="mb-1.5 text-xs text-faint">Reported</div>
          <PersonCell person={r.reported} />
          {r.reportedOpenReports > 1 && (
            <div className="mt-2">
              <Badge tone="danger">{r.reportedOpenReports} open reports</Badge>
            </div>
          )}
        </div>
        <div className="min-w-48">
          <div className="mb-1.5 text-xs text-faint">By</div>
          <PersonCell person={r.reporter} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge tone="warning">{titleCase(r.reason)}</Badge>
            <span className="text-xs text-faint">{timeAgo(r.createdAt)}</span>
          </div>
          <p className="mt-2 text-sm whitespace-pre-wrap text-muted">{r.details || 'No details given.'}</p>
          {r.resolutionNote && <p className="mt-2 text-sm">Note: {r.resolutionNote}</p>}
        </div>
        {r.status === 'open' && (
          <div className="flex gap-2">
            <Button size="sm" onClick={dismiss} loading={busy === 'dismiss'}>
              Dismiss
            </Button>
            <Button size="sm" variant="danger" onClick={act} loading={busy === 'act'}>
              Take action
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
