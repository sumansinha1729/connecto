import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { adminApi } from '../api/admin';
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader, PersonCell, Table, Td } from '../components/ui';
import { formatDate, formatNumber, timeAgo } from '../lib/format';
import { RoleBadge, StatusBadge } from './UserDetail';

const select = 'h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary';

export function UsersPage() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [listenerStatus, setListenerStatus] = useState('');
  const [page, setPage] = useState(1);

  // Search after the admin stops typing
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [text]);

  const list = useQuery({
    queryKey: ['users', q, role, status, listenerStatus, page],
    queryFn: () => adminApi.searchUsers({ q, role, status, listenerStatus, page }),
    placeholderData: keepPreviousData,
  });
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / 30)) : 1;

  return (
    <>
      <PageHeader title="Users" subtitle={list.data ? `${formatNumber(list.data.total)} accounts match` : undefined} />
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-primary">
          <Search size={16} className="text-faint" />
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by name or phone" className="h-full flex-1 bg-transparent text-sm outline-none" />
        </label>
        <select className={select} value={role} onChange={(e) => (setRole(e.target.value), setPage(1))}>
          <option value="">Everyone</option>
          <option value="user">Users</option>
          <option value="listener">Listeners</option>
        </select>
        <select className={select} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
          <option value="">Active + banned</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
          <option value="deleted">Deleted</option>
        </select>
        <select className={select} value={listenerStatus} onChange={(e) => (setListenerStatus(e.target.value), setPage(1))}>
          <option value="">Any application</option>
          <option value="pending">Application waiting</option>
          <option value="approved">Approved listener</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <Card>
          {list.data.users.length === 0 ? (
            <Empty title="No one matches" hint="Try part of a name, or at least 4 digits of a phone number." />
          ) : (
            <Table head={['Person', 'Type', 'Status', 'Calls', 'Joined', 'Last seen']}>
              {list.data.users.map((u) => (
                <tr key={u.id} className="cursor-pointer hover:bg-surface-2/50" onClick={() => navigate(`/users/${u.id}`)}>
                  <Td>
                    <PersonCell person={u} />
                  </Td>
                  <Td>
                    <RoleBadge user={u} />
                  </Td>
                  <Td>
                    <StatusBadge user={u} />
                  </Td>
                  <Td className="tabular">{formatNumber(u.totalCalls)}</Td>
                  <Td className="text-muted">{formatDate(u.createdAt)}</Td>
                  <Td className="text-muted">{u.isOnline ? <Badge tone="success">Online</Badge> : timeAgo(u.lastSeenAt)}</Td>
                </tr>
              ))}
            </Table>
          )}
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="tabular text-xs text-faint">
                Page {page} of {pages}
              </span>
              <Button size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
