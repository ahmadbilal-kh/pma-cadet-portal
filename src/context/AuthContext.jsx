import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { configured, supabase } from '../lib/supabase';
import { AVATAR_BUCKET, prepareAvatar } from '../lib/avatar';
import { createUUID } from '../lib/uuid';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(configured);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const completePasswordRecovery = useCallback(() => setPasswordRecovery(false), []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) console.warn('Unable to restore session:', error.message);
      setSession(data?.session ?? null);
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (alive) {
        sessionRef.current = nextSession;
        if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
        if (event === 'SIGNED_OUT') setPasswordRecovery(false);
        setSession(nextSession); setLoading(false);
      }
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  const avatarPath = session?.user?.user_metadata?.avatar_path;
  const userId = session?.user?.id;
  useEffect(() => {
    if (!supabase || !userId || typeof avatarPath !== 'string' || !avatarPath.startsWith(`${userId}/`)) return;
    let alive = true;
    let refreshTimer;
    async function load() {
      try {
        const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(avatarPath, 3600);
        if (!alive) return;
        if (error) throw error;
        setAvatar({ userId, path: avatarPath, url: data.signedUrl });
        refreshTimer = setTimeout(load, 50 * 60 * 1000);
      } catch { if (alive) refreshTimer = setTimeout(load, 60 * 1000); }
    }
    load();
    return () => { alive = false; clearTimeout(refreshTimer); };
  }, [userId, avatarPath]);

  const updateAvatar = useCallback(async file => {
    const account = sessionRef.current?.user;
    if (!supabase || !account) throw new Error('Please log in again to update your photo.');
    const bucket = supabase.storage.from(AVATAR_BUCKET);
    let path = null;
    if (file) {
      const image = await prepareAvatar(file);
      path = `${account.id}/${createUUID()}.webp`;
      const { error } = await bucket.upload(path, image, { contentType: 'image/webp', upsert: false });
      if (error) {
        if (/bucket.*not found|row.level security/i.test(error.message || '')) throw new Error('Photo storage needs setup. Run supabase/avatar-storage.sql in the Supabase SQL Editor, then try again.');
        throw error;
      }
    }
    try {
      if (sessionRef.current?.user?.id !== account.id) throw new Error('Your session changed. Please log in again.');
      const { data, error } = await supabase.auth.updateUser({ data: { avatar_path: path } });
      if (error) throw error;
      if (data?.user?.id !== account.id) throw new Error('Your photo could not be saved. Please try again.');
      setSession(previous => previous?.user.id === account.id ? { ...previous, user: data.user } : previous);
    } catch (error) {
      if (path) await bucket.remove([path]).catch(() => {});
      throw error;
    }
    const oldPath = account.user_metadata?.avatar_path;
    if (typeof oldPath === 'string' && oldPath.startsWith(`${account.id}/`)) await bucket.remove([oldPath]).catch(() => {});
  }, []);

  const refreshUser = useCallback(async () => {
    if (!supabase) return;
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) return;
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    setSession(previous => previous && previous.user.id === data.user.id
      ? { ...previous, user: data.user } : previous);
  }, []);

  const updateProfile = useCallback(async fullName => {
    const name = typeof fullName === 'string' ? fullName.trim() : '';
    if (name.length < 2 || name.length > 80) throw new Error('Enter your full name (2 to 80 characters).');
    const userId = session?.user?.id;
    if (!supabase || !userId) throw new Error('Please log in again to update your profile.');
    const { data, error } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error) throw error;
    if (!data?.user || data.user.id !== userId) throw new Error('Your profile could not be updated. Please try again.');
    setSession(previous => previous?.user.id === userId ? { ...previous, user: data.user } : previous);
    return data.user;
  }, [session?.user?.id]);

  const value = useMemo(() => ({
    passwordRecovery,
    completePasswordRecovery,
    refreshUser,
    updateProfile,
    updateAvatar,
    avatarUrl: avatar && avatar.userId === userId && avatar.path === avatarPath ? avatar.url : '',
    session,
    user: session?.user ?? null,
    loading,
    configured,
    signOut: async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [session, loading, refreshUser, updateProfile, updateAvatar, avatar, userId, avatarPath, passwordRecovery, completePasswordRecovery]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
