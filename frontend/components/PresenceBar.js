'use client';

import styles from './PresenceBar.module.css';

function Avatar({ user, size = 30 }) {
  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() || '?';

  return (
    <div
      className={styles.avatar}
      style={{ background: user.color || '#7C6EFA', width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

export default function PresenceBar({ activeUsers }) {
  if (!activeUsers || activeUsers.length === 0) return null;

  const MAX_SHOW = 4;
  const shown = activeUsers.slice(0, MAX_SHOW);
  const overflow = activeUsers.length - MAX_SHOW;

  const summary = activeUsers.length === 1
    ? `${activeUsers[0].name || activeUsers[0].email?.split('@')[0] || 'Someone'} is editing`
    : `${activeUsers.length} people editing`;

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <div className={styles.pulse} />
        <span className={styles.liveLabel}>{summary}</span>
      </div>

      <div className={styles.users}>
        {shown.map((u, i) => (
          <div key={u.clientId || i} className={styles.userChip} style={{ borderColor: u.color || '#7C6EFA' }}>
            <Avatar user={u} size={22} />
            <span className={styles.userName}>{u.name || u.email?.split('@')[0]}</span>
          </div>
        ))}
        {overflow > 0 && (
          <div className={styles.overflow}>+{overflow} more</div>
        )}
      </div>
    </div>
  );
}
