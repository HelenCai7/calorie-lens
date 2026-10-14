import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Google 登录和邮件里的登录链接都会跳回这里，用 code 换取登录状态。
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = supabase ? await supabase.auth.exchangeCodeForSession(code) : { error: true };
    if (!error) return NextResponse.redirect(`${origin}/`);
  }

  return NextResponse.redirect(`${origin}/?authError=1`);
}
