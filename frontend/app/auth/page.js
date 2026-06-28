'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import styles from './auth.module.css';

export default function AuthPage() {
  const [mode, setMode] = useState('signin'); // signin | signup | forgot | set-password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('mode') === 'reset') {
      setMode('set-password');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await signUp(email, password, name);
        if (error) throw error;
        setMode('confirm');
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setMode('forgot-sent');
      } else if (mode === 'set-password') {
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        // Sign out so user must log in with the new password
        await supabase.auth.signOut();
        setMode('password-updated');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setPassword('');
    setShowPassword(false);
  };

  // Full-screen info screens
  if (mode === 'confirm' || mode === 'forgot-sent' || mode === 'password-updated') {
    const config = {
      confirm: {
        icon: '✓',
        title: 'Check your email',
        msg: <>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</>,
      },
      'forgot-sent': {
        icon: '✉',
        title: 'Check your email',
        msg: <>We sent a password reset link to <strong>{email}</strong>.</>,
      },
      'password-updated': {
        icon: '✓',
        title: 'Password updated',
        msg: 'Your password has been changed. Sign in with your new password.',
      },
    }[mode];

    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <Logo />
          <div className={styles.confirmMsg}>
            <div className={styles.confirmIcon}>{config.icon}</div>
            <h2>{config.title}</h2>
            <p>{config.msg}</p>
            <button className={styles.link} onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Logo />

        <h1 className={styles.title}>
          {mode === 'signin' ? 'Welcome back'
            : mode === 'signup' ? 'Create account'
            : mode === 'set-password' ? 'Set new password'
            : 'Reset password'}
        </h1>
        <p className={styles.subtitle}>
          {mode === 'signin' ? 'Sign in to your workspace'
            : mode === 'signup' ? 'Start collaborating in seconds'
            : mode === 'set-password' ? 'Choose a new password for your account'
            : "Enter your email and we'll send a reset link"}
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className={styles.field}>
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoComplete="name"
              />
            </div>
          )}

          {mode !== 'set-password' && (
            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
          )}

          {mode !== 'forgot' && (
            <div className={styles.field}>
              <label htmlFor="password">
                {mode === 'set-password' ? 'New password' : 'Password'}
              </label>
              <div className={styles.passwordWrap}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signin' ? '••••••••' : 'Min 6 characters'}
                  required
                  minLength={6}
                  autoComplete={mode === 'signup' || mode === 'set-password' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff /> : <EyeOn />}
                </button>
              </div>
              {mode === 'signin' && (
                <button type="button" className={styles.forgotLink} onClick={() => switchMode('forgot')}>
                  Forgot password?
                </button>
              )}
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.spinner} />
              : mode === 'signin' ? 'Sign in'
              : mode === 'signup' ? 'Create account'
              : mode === 'set-password' ? 'Update password'
              : 'Send reset link'}
          </button>
        </form>

        {mode === 'signin' || mode === 'signup' ? (
          <p className={styles.toggle}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button className={styles.link} onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        ) : (
          <p className={styles.toggle}>
            <button className={styles.link} onClick={() => switchMode('signin')}>
              ← Back to sign in
            </button>
          </p>
        )}
      </div>

      <div className={styles.bg}>
        <div className={styles.blob1} />
        <div className={styles.blob2} />
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className={styles.logo}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#7C6EFA"/>
        <path d="M8 11h16M8 16h12M8 21h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      <span>Collabit</span>
    </div>
  );
}

function EyeOn() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
