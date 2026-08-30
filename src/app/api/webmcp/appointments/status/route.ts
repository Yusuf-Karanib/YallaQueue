import type { NextRequest } from "next/server";
import {
  DashboardAccessError,
  requireDashboardShop,
} from "@/src/dashboard/access";
import { getDateInTimeZone } from "@/src/dashboard/model";
import { queueStatusUpdateSchema } from "@/src/webmcp/model";

const noStoreHeaders = { "cache-control": "no-store" };

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return Response.json(
      { error: "Cross-site updates are not allowed." },
      { status: 403, headers: noStoreHeaders },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "The update must be valid JSON." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const parsed = queueStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Use a valid queue number, date, and status." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  try {
    const { supabase, shop } = await requireDashboardShop();
    const serviceDate =
      parsed.data.serviceDate ?? getDateInTimeZone(new Date(), shop.timezone);
    const appointmentResult = await supabase
      .from("appointments")
      .select("id,queue_number,service_date,status")
      .eq("shop_id", shop.id)
      .eq("service_date", serviceDate)
      .eq("queue_number", parsed.data.queueNumber)
      .maybeSingle();

    if (appointmentResult.error) {
      throw new Error("Unable to find the appointment.");
    }

    if (!appointmentResult.data) {
      return Response.json(
        { error: `Queue ${parsed.data.queueNumber} was not found on ${serviceDate}.` },
        { status: 404, headers: noStoreHeaders },
      );
    }

    const updateResult = await supabase
      .from("appointments")
      .update({ status: parsed.data.status })
      .eq("shop_id", shop.id)
      .eq("id", appointmentResult.data.id)
      .select("queue_number,service_date,status")
      .single();

    if (updateResult.error) {
      return Response.json(
        { error: "The status could not be changed. Check for a scheduling conflict." },
        { status: 409, headers: noStoreHeaders },
      );
    }

    return Response.json(
      {
        shop: shop.name,
        queueNumber: updateResult.data.queue_number,
        serviceDate: updateResult.data.service_date,
        status: updateResult.data.status,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof DashboardAccessError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: noStoreHeaders },
      );
    }

    console.error("WebMCP queue update failed", error);
    return Response.json(
      { error: "The appointment could not be updated." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
