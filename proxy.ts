import type { NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/src/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
