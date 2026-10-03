import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, Coins, ShieldOff, Star, UserCheck } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { adminApi } from '../api/admin';
import type { AdminUser } from '../api/types';
import { askConfirm, askForm } from '../components/dialogs';
import { Avatar, Badge, Button, Card, Empty, ErrorBox, Loading, Stat, Table, Td } from '../components/ui';
import { formatDate, formatDateTime, formatDuration, formatNumber, formatPhone, formatRupees, timeAgo, titleCase } from '../lib/format';
import { useAction, useSession } from '../lib/hooks';

export function RoleBadge({ user: u }: { user: AdminUser }) {
  if (u.isAdmin) return <Badge tone="primary">Admin</Badge>;
  if (u.role === 'listener') return <Badge tone="primary">Listener</Badge>;
  if (u.listenerStatus === 'pending') return <Badge tone="warning">Applied</Badge>;
  return <Badge>User</Badge>;
}

export function StatusBadge({ user: u }: { user: AdminUser }) {
  if (u.status === 'banned') return <Badge tone="danger">Banned</Badge>;
  if (u.status === 'deleted') return <Badge>Deleted</Badge>;
  if (!u.profileComplete) return <Badge tone="warning">Signing up</Badge>;
  return <Badge tone="success">Active</Badge>;
}

export function UserDetailPage() {
  const { id = '' } = useParams();
  const me = useSession()?.user;
  const detail = useQuery({ queryKey: ['user', id], queryFn: () => adminApi.user(id) });
  const { busy, run } = useAction();

  if (detail.isPending) return <Loading />;
  if (detail.isError) return <ErrorBox error={detail.error} onRetry={() => detail.refetch()} />;
  const { user: u, wallet, earnings, calls, reports, auditLog } = detail.data;
  const isMe = me?.id === u.id;
  const app = u.listenerApplication;

  const ban = async () => {
    const values = await askForm({
      title: `Ban ${u.name}?`,
      message: 'They are logged out everywhere, any call they are in ends, and they can’t log in again until unbanned.',
      confirmText: 'Ban',
      destructive: true,
      fields: [{ name: 'reason', label: 'Reason', type: 'textarea', minLength: 3 }],
    });
    if (values) await run('ban', () => adminApi.ban(u.id, String(values.reason).trim()), `${u.name} banned`);
  };
  const unban = async () => {
    if (await askConfirm({ title: `Unban ${u.name}?`, message: 'They can log in and use the app again.', confirmText: 'Unban' })) {
      await run('unban', () => adminApi.unban(u.id), `${u.name} unbanned`);
    }
  };
  const adjust = async () => {
    const values = await askForm({
      title: `Adjust ${u.name}’s coins`,
      message: `Current balance: ${formatNumber(wallet.balance)} coins. Use a minus sign to remove coins.`,
      confirmText: 'Save',
      fields: [
        { name: 'amount', label: 'Coins', type: 'number', placeholder: 'e.g. 50 or -20' },
        { name: 'reason', label: 'Reason (shown in their history)', minLength: 3, placeholder: 'e.g. Refund for a dropped call' },
      ],
    });
    if (values) await run('adjust', () => adminApi.adjustWallet(u.id, Math.trunc(Number(values.amount)), String(values.reason).trim()), 'Coins updated');
  };
  const revoke = async () => {
    const values = await askForm({
      title: `Remove ${u.name}’s listener rights?`,
      message: 'They become a normal user. Their earnings stay; their coins work again.',
      confirmText: 'Remove',
      destructive: true,
      fields: [{ name: 'note', label: 'Reason', type: 'textarea', minLength: 3 }],
    });
    if (values) await run('revoke', () => adminApi.revokeListener(u.id, String(values.note).trim()), 'Listener rights removed');
  };

  return (
    <>
      <Link to="/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={15} /> Users
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-5">
        <Avatar avatar={u.avatar} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{u.name || 'No name yet'}</h1>
            <RoleBadge user={u} />
            <StatusBadge user={u} />
            {u.isOnline && <Badge tone="success">Online</Badge>}
          </div>
          <div className="tabular mt-1 text-sm text-muted">
            {formatPhone(u.phone)} · {[u.gender && titleCase(u.gender), u.age && `${u.age} yrs`].filter(Boolean).join(' · ')} · joined {formatDate(u.createdAt)} · last seen{' '}
            {u.isOnline ? 'now' : timeAgo(u.lastSeenAt)}
          </div>
          {u.status === 'banned' && u.banReason && <p className="mt-2 text-sm text-danger">Banned {timeAgo(u.bannedAt)}: {u.banReason}</p>}
        </div>
        {!isMe && u.status !== 'deleted' && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={adjust} loading={busy === 'adjust'}>
              <Coins size={15} /> Adjust coins
            </Button>
            {u.role === 'listener' && (
              <Button onClick={revoke} loading={busy === 'revoke'}>
                <ShieldOff size={15} /> Remove listener
              </Button>
            )}
            {u.status === 'banned' ? (
              <Button variant="primary" onClick={unban} loading={busy === 'unban'}>
                <UserCheck size={15} /> Unban
              </Button>
            ) : (
              !u.isAdmin && (
                <Button variant="danger" onClick={ban} loading={busy === 'ban'}>
                  <Ban size={15} /> Ban
                </Button>
              )
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Coins" value={formatNumber(wallet.balance)} tone="warning" />
        <Stat label="Calls" value={formatNumber(u.totalCalls)} />
        <Stat
          label="Rating"
          value={
            u.ratingCount ? (
              <span className="inline-flex items-center gap-1.5">
                <Star size={18} className="fill-coin text-coin" /> {u.rating.toFixed(1)}
              </span>
            ) : (
              '—'
            )
          }
          hint={u.ratingCount ? `${u.ratingCount} ratings` : undefined}
        />
        <Stat label="Reports against" value={formatNumber(reports.against.length)} tone={reports.against.length ? 'danger' : 'default'} hint={`made ${reports.madeCount}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Profile">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div className="col-span-2">
              <dt className="text-xs text-faint">Bio</dt>
              <dd className="text-muted">{u.bio || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Languages</dt>
              <dd>{u.languages.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Interests</dt>
              <dd>{u.interests.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Signed up as</dt>
              <dd>{u.signupIntent === 'listener' ? 'Listener' : 'User'}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Listener status</dt>
              <dd>{titleCase(u.listenerStatus)}</dd>
            </div>
          </dl>
        </Card>

        {(u.listenerStatus !== 'none' || u.role === 'listener') && (
          <Card title="Listener" right={u.listenerStatus === 'pending' && <Link to="/applications" className="text-xs text-primary hover:underline">Review application →</Link>}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-faint">Full name</dt>
                <dd>{app.fullName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">Date of birth · City</dt>
                <dd>
                  {formatDate(app.dateOfBirth)} · {app.city ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-faint">Earnings balance</dt>
                <dd className="text-success">{formatRupees(earnings.balancePaise)}</dd>
              </div>
              <div>
                <dt className="text-xs text-faint">Earned in total</dt>
                <dd>{formatRupees(earnings.lifetimePaise)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-faint">Payout details</dt>
                <dd>
                  {u.payoutMethod
                    ? u.payoutMethod.kind === 'upi'
                      ? `UPI · ${u.payoutMethod.upiId} (${u.payoutMethod.accountName})`
                      : `Bank · ${u.payoutMethod.accountName} · A/c ${u.payoutMethod.accountNumber} · ${u.payoutMethod.ifsc}`
                    : 'Not added'}
                </dd>
              </div>
              {app.voiceIntroUrl && (
                <div className="col-span-2">
                  <dt className="mb-1 text-xs text-faint">Voice intro</dt>
                  <audio controls preload="none" src={app.voiceIntroUrl} className="w-full" />
                </div>
              )}
            </dl>
          </Card>
        )}

        <Card title="Recent calls">
          {calls.length === 0 ? (
            <Empty title="No calls yet" />
          ) : (
            <Table head={['With', 'When', 'Length', 'Status', u.role === 'listener' ? 'Earned' : 'Coins']}>
              {calls.slice(0, 15).map((c) => (
                <tr key={c.id}>
                  <Td>
                    <Link to={`/users/${c.peer.id}`} className="flex items-center gap-2 hover:text-primary">
                      <Avatar avatar={c.peer.avatar} size={26} /> {c.peer.name}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(c.startedAt)}</Td>
                  <Td className="tabular">{c.durationSec ? formatDuration(c.durationSec) : '—'}</Td>
                  <Td>
                    <Badge tone={c.status === 'completed' ? 'success' : 'default'}>{titleCase(c.status)}</Badge>
                  </Td>
                  <Td className="tabular">{c.direction === 'incoming' ? formatRupees(c.earnedPaise) : formatNumber(c.coins)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Coin history">
          {wallet.transactions.length === 0 ? (
            <Empty title="No coin activity" />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {wallet.transactions.slice(0, 15).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{t.description}</span>
                    <span className="text-xs text-faint">{formatDateTime(t.createdAt)}</span>
                  </span>
                  <span className={`tabular font-medium ${t.amount >= 0 ? 'text-success' : 'text-muted'}`}>
                    {t.amount >= 0 ? '+' : ''}
                    {formatNumber(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Reports against them">
          {reports.against.length === 0 ? (
            <Empty title="No reports" />
          ) : (
            <ul className="space-y-3 text-sm">
              {reports.against.map((r) => (
                <li key={r.id}>
                  <div className="flex items-center gap-2">
                    <Badge tone="warning">{titleCase(r.reason)}</Badge>
                    <Badge tone={r.status === 'open' ? 'danger' : 'default'}>{titleCase(r.status)}</Badge>
                    <span className="text-xs text-faint">{timeAgo(r.createdAt)}</span>
                  </div>
                  {r.details && <p className="mt-1 text-muted">{r.details}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Admin actions on this account">
          {auditLog.length === 0 ? (
            <Empty title="None" />
          ) : (
            <ul className="space-y-2 text-sm">
              {auditLog.map((a, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{titleCase(a.action)}</span>
                  <span className="text-xs text-faint">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
