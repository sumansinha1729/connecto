import { useQuery } from '@tanstack/react-query';
import { Calendar, Check, Languages, MapPin, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { adminApi } from '../api/admin';
import type { AdminUser } from '../api/types';
import { askConfirm, askForm } from '../components/dialogs';
import { Avatar, Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader, Tabs } from '../components/ui';
import { formatDate, formatPhone, timeAgo } from '../lib/format';
import { useAction } from '../lib/hooks';

type Status = 'pending' | 'approved' | 'rejected';

function ageFrom(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
}

export function ApplicationsPage() {
  const [status, setStatus] = useState<Status>('pending');
  const list = useQuery({ queryKey: ['applications', status], queryFn: () => adminApi.applications(status), refetchInterval: 30_000 });

  return (
    <>
      <PageHeader
        title="Listener applications"
        subtitle="Listen to the voice intro and check the details before approving."
        right={
          <Tabs
            value={status}
            onChange={setStatus}
            options={[
              { value: 'pending', label: 'Waiting' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        }
      />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.applications.length === 0 ? (
        <Card>
          <Empty title={status === 'pending' ? 'No applications waiting' : 'Nothing here'} hint={status === 'pending' ? 'New applications appear here automatically.' : undefined} />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {list.data.applications.map((u) => (
            <ApplicationCard key={u.id} user={u} />
          ))}
        </div>
      )}
    </>
  );
}

function ApplicationCard({ user: u }: { user: AdminUser }) {
  const { busy, run } = useAction();
  const app = u.listenerApplication;
  const age = ageFrom(app.dateOfBirth);

  const approve = async () => {
    if (await askConfirm({ title: `Approve ${u.name} as a listener?`, message: 'They can start taking paid calls straight away.', confirmText: 'Approve' })) {
      await run('approve', () => adminApi.approve(u.id), `${u.name} is now a listener`);
    }
  };
  const reject = async () => {
    const values = await askForm({
      title: `Reject ${u.name}’s application?`,
      message: 'They’ll see this reason in the app and can apply again.',
      confirmText: 'Reject',
      destructive: true,
      fields: [{ name: 'note', label: 'Reason', type: 'textarea', minLength: 3, placeholder: 'e.g. The voice intro wasn’t clear' }],
    });
    if (values) await run('reject', () => adminApi.reject(u.id, String(values.note).trim()), 'Application rejected');
  };

  return (
    <Card>
      <div className="flex items-start gap-4">
        <Avatar avatar={u.avatar} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/users/${u.id}`} className="text-base font-semibold hover:text-primary">
              {u.name}
            </Link>
            {u.signupIntent === 'listener' ? <Badge tone="primary">Signed up as listener</Badge> : <Badge>Existing user</Badge>}
          </div>
          <div className="tabular text-sm text-muted">
            {formatPhone(u.phone)} · applied {timeAgo(app.appliedAt)}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-faint">Full name (private)</dt>
          <dd className="font-medium">{app.fullName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-faint">Gender</dt>
          <dd className="capitalize">{u.gender ?? '—'}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-xs text-faint">
            <Calendar size={12} /> Date of birth
          </dt>
          <dd>
            {formatDate(app.dateOfBirth)} {age !== null && <span className="text-muted">({age} yrs)</span>}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-xs text-faint">
            <MapPin size={12} /> City
          </dt>
          <dd>{app.city ?? '—'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="flex items-center gap-1 text-xs text-faint">
            <Languages size={12} /> Languages
          </dt>
          <dd>{u.languages.join(', ') || '—'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-faint">About</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-muted">{app.about ?? '—'}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="mb-1.5 text-xs text-faint">Voice intro {app.voiceIntroDurationSec ? `· ${app.voiceIntroDurationSec}s` : ''}</div>
        {app.voiceIntroUrl ? <audio controls preload="none" src={app.voiceIntroUrl} className="w-full" /> : <span className="text-sm text-faint">No recording</span>}
      </div>

      {app.note && u.listenerStatus === 'rejected' && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">Rejected: {app.note}</p>}

      {u.listenerStatus === 'pending' && (
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={reject} loading={busy === 'reject'}>
            <X size={15} /> Reject
          </Button>
          <Button variant="primary" onClick={approve} loading={busy === 'approve'}>
            <Check size={15} /> Approve
          </Button>
        </div>
      )}
    </Card>
  );
}
