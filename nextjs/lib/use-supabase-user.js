"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase/client";

export function useSupabaseUser() {
  const [supabase] = useState(() => getSupabaseBrowserClient());
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setReady(true);
    });

    // 回调里只更新状态，不要调用其他 Supabase 方法，否则可能卡死。
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return { supabase, user, ready };
}
