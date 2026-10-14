import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfigured, supabaseKey, supabaseUrl } from "./env";

// 每个请求都要新建一个客户端，不能跨请求共用。
export async function createSupabaseServerClient() {
  if (!supabaseConfigured) return null;

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 在服务端组件里不能写 cookie；登录状态由 proxy.js 负责刷新。
        }
      }
    }
  });
}

export async function getSignedInUserId() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getClaims();
  if (error) return null;
  return data?.claims?.sub || null;
}
