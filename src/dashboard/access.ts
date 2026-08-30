import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const membershipSchema = z.object({
  shop_id: z.string().uuid(),
  role: z.enum(["owner", "manager"]),
});

const shopSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  timezone: z.string().min(1),
  default_appointment_minutes: z.number().int().positive(),
});

export class DashboardAccessError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 500,
  ) {
    super(message);
  }
}

export async function requireDashboardShop() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    throw new DashboardAccessError("Sign in to use the shop tools.", 401);
  }

  const membershipResult = await supabase
    .from("shop_members")
    .select("shop_id,role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membershipResult.error) {
    throw new DashboardAccessError("Unable to check shop access.", 500);
  }

  const membership = membershipSchema.safeParse(membershipResult.data);
  if (!membership.success) {
    throw new DashboardAccessError("This login has no assigned shop.", 403);
  }

  const shopResult = await supabase
    .from("shops")
    .select("id,name,timezone,default_appointment_minutes")
    .eq("id", membership.data.shop_id)
    .single();

  if (shopResult.error) {
    throw new DashboardAccessError("Unable to load the assigned shop.", 500);
  }

  return {
    supabase,
    userId,
    role: membership.data.role,
    shop: shopSchema.parse(shopResult.data),
  };
}
