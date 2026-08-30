"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appointmentStatusSchema } from "@/src/dashboard/model";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const updateStatusSchema = z.object({
  appointmentId: z.string().uuid(),
  status: appointmentStatusSchema,
});

async function requireSignedInClient() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  return supabase;
}

export async function updateAppointmentStatus(formData: FormData) {
  const parsed = updateStatusSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    redirect("/dashboard?error=That+appointment+update+was+invalid.");
  }

  const supabase = await requireSignedInClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.appointmentId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect("/dashboard?error=The+appointment+could+not+be+updated.");
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?updated=1");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
