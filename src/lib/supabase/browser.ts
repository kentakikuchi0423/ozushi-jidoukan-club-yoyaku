"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// Client Component 専用の Supabase クライアント。
// publishable key を使うため RLS が適用される。
// Server Component / Route Handler / Server Action では `@/lib/supabase/server`
// を使うこと。
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
  );
}
