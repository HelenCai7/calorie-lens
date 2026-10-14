import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfigured, supabaseKey, supabaseUrl } from "./env";

export function getSupabaseBrowserClient() {
  if (!supabaseConfigured) return null;
  // createBrowserClient 在浏览器里本身就是单例，重复调用会拿到同一个实例。
  return createBrowserClient(supabaseUrl, supabaseKey);
}
