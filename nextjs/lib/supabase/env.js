// Vercel 的 Supabase 集成会注入 NEXT_PUBLIC_SUPABASE_URL，以及 ANON_KEY 或 PUBLISHABLE_KEY 之一。
// 必须按字面写出变量名，Next.js 才会在构建时把它们打包进前端代码。
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);
