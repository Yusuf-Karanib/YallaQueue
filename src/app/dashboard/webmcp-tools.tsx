"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatQueueSummaryForAgent,
  queueStatusUpdateSchema,
  type AgentQueueSummary,
} from "@/src/webmcp/model";
import styles from "./webmcp-tools.module.css";

type RegistrationState = "ready" | "unsupported" | "error";

function textResult(text: string) {
  return { content: [{ type: "text", text }] };
}

async function readJson(response: Response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "The YallaQueue tool failed.");
  }
  return data;
}

export default function WebMcpTools() {
  const router = useRouter();
  const [state, setState] = useState<RegistrationState>("unsupported");

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      return;
    }

    const controller = new AbortController();
    const registerTool = modelContext.registerTool.bind(modelContext);

    async function registerTools() {
      try {
        await Promise.all([
          registerTool(
            {
              name: "get_queue_summary",
              title: "Get live queue summary",
              description:
                "Read the signed-in shop's live queue for today and upcoming appointments. Use this before answering queue questions or changing a status. The result excludes customer phone numbers.",
              inputSchema: {
                type: "object",
                properties: {},
                additionalProperties: false,
              },
              annotations: { readOnlyHint: true },
              async execute(_input, options) {
                const response = await fetch("/api/webmcp/queue", {
                  cache: "no-store",
                  credentials: "same-origin",
                  signal: options.signal,
                });
                const summary = (await readJson(response)) as AgentQueueSummary;
                return textResult(formatQueueSummaryForAgent(summary));
              },
            },
            { signal: controller.signal },
          ),
          registerTool(
            {
              name: "update_queue_status",
              title: "Update an appointment status",
              description:
                "Change one appointment status by queue number. This modifies the signed-in shop's data. Only call it after the user clearly asks for the change. Omit serviceDate to update today's queue in the shop timezone.",
              inputSchema: {
                type: "object",
                properties: {
                  queueNumber: {
                    type: "integer",
                    minimum: 1,
                    maximum: 10_000,
                    description: "The visible queue number to update.",
                  },
                  serviceDate: {
                    type: "string",
                    format: "date",
                    description:
                      "Optional appointment date in YYYY-MM-DD format. Defaults to today in the shop timezone.",
                  },
                  status: {
                    type: "string",
                    enum: ["confirmed", "completed", "cancelled", "no_show"],
                    description: "The new appointment status.",
                  },
                },
                required: ["queueNumber", "status"],
                additionalProperties: false,
              },
              annotations: { readOnlyHint: false },
              async execute(input, options) {
                const parsed = queueStatusUpdateSchema.safeParse(input);
                if (!parsed.success) {
                  throw new Error("Use a valid queue number, date, and status.");
                }

                const response = await fetch(
                  "/api/webmcp/appointments/status",
                  {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(parsed.data),
                    signal: options.signal,
                  },
                );
                const result = await readJson(response);
                router.refresh();
                return textResult(
                  `Queue ${result.queueNumber} on ${result.serviceDate} is now ${result.status}. The dashboard has been refreshed.`,
                );
              },
            },
            { signal: controller.signal },
          ),
        ]);
        setState("ready");
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("WebMCP tool registration failed", error);
          setState("error");
        }
      }
    }

    void registerTools();
    return () => controller.abort();
  }, [router]);

  const status = {
    ready: "2 agent tools ready",
    unsupported: "Open in ChatGPT or enable WebMCP in Chrome",
    error: "Agent tools could not start",
  }[state];

  return (
    <section className={styles.card} aria-label="WebMCP agent tools">
      <div>
        <p className={styles.eyebrow}>WebMCP agent tools</p>
        <h2>Manage the queue with your agent</h2>
        <p>
          Ask: “Summarize today&apos;s queue” or “Mark queue 1 completed.”
        </p>
      </div>
      <span className={`${styles.status} ${styles[state]}`}>{status}</span>
    </section>
  );
}
