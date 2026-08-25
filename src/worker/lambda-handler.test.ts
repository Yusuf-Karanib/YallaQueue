import { describe, expect, it, vi } from "vitest";
import type { LambdaSqsEvent } from "queuecraft";
import { createLambdaWorkerHandler } from "./lambda-handler";

const event: LambdaSqsEvent = { Records: [] };

describe("Lambda worker handler", () => {
  it("passes a live ownership signal to QueueCraft", async () => {
    const process = vi.fn().mockResolvedValue({ batchItemFailures: [] });
    const handler = createLambdaWorkerHandler({ process });

    await expect(
      handler(event, { getRemainingTimeInMillis: () => 30_000 }),
    ).resolves.toEqual({ batchItemFailures: [] });
    expect(process).toHaveBeenCalledWith(event, {
      signal: expect.any(AbortSignal),
    });
    expect(process.mock.calls[0][1].signal.aborted).toBe(false);
  });

  it("aborts before Lambda's hard timeout", async () => {
    vi.useFakeTimers();
    const process = vi.fn(
      async (_event: LambdaSqsEvent, options: { signal: AbortSignal }) => {
        await new Promise<void>((resolve) =>
          options.signal.addEventListener("abort", () => resolve(), {
            once: true,
          }),
        );
        return { batchItemFailures: [] };
      },
    );
    const handler = createLambdaWorkerHandler({ process });
    const result = handler(event, { getRemainingTimeInMillis: () => 1_000 });

    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual({ batchItemFailures: [] });
    expect(process.mock.calls[0][1].signal.aborted).toBe(true);
    vi.useRealTimers();
  });
});
