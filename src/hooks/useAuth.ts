import { useEffect, useState } from 'react';
import { type User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';

export function useAuth() {
  const supabase = getSupabaseClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => supabase !== null);

  useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      return undefined;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) {
          return;
        }

        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setUser(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return {
    isAuthenticated: user !== null,
    loading,
    user,
  };
}
