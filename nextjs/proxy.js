import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { supabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/env";

// 每次请求前刷新 Supabase 登录状态，把新的 token 写回 cookie。
export async function proxy(request) {
  let response = NextResponse.next({ request });
  if (!supabaseConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // 带登录 cookie 的响应不能被 CDN 缓存，否则可能把一个人的登录状态发给别人。
        Object.entries(headers || {}).forEach(([key, value]) => response.headers.set(key, value));
      }
    }
  });

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]
};
