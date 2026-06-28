'use client';

import styles from './PresenceBar.module.css';

function Avatar({ user, size = 28 }) {
  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() || '?';

  return (
    <div
      className={styles.avatar}
      style={{
        background: user.color || '#7C6EFA',
        width: size,
        height: size,
        fontSize: size * 0.38,
      }}
      title={user.name || user.email}
    >
      {initials}
    </div>
  );
}

export default function PresenceBar({ activeUsers }) {
  if (!activeUsers || activeUsers.length === 0) return null;

  const MAX_SHOW = 5;
  const shown = activeUsers.slice(0, MAX_SHOW);
  const overflow = activeUsers.length - MAX_SHOW;

  return (
    <div className={styles.bar}>
      <div className={styles.label}>
        <div className={styles.pulse} />
        {activeUsers.length === 1 ? 'Only you' : `${activeUsers.length} editing`}
      </div>
      <div className={styles.avatars}>
        {shown.map((u, i) => (
          <div
            key={u.clientId || i}
            className={styles.avatarWrap}
            style={{ zIndex: MAX_SHOW - i }}
          >
            <Avatar user={u} />
            <div className={styles.tooltip}>
              {u.name || u.email}
            </div>
          </div>
        ))}
        {overflow > 0 && (
          <div
            className={styles.overflow}
            style={{ zIndex: 0 }}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
