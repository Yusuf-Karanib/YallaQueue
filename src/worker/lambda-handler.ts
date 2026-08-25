import type {
  LambdaSqsBatchResponse,
  LambdaSqsEvent,
  QueueCraftLambdaProcessor,
} from "queuecraft";

export interface LambdaRuntimeContext {
  getRemainingTimeInMillis(): number;
}

type LambdaProcessor = Pick<QueueCraftLambdaProcessor, "process">;

const SHUTDOWN_SAFETY_MARGIN_MS = 2_000;

export function createLambdaWorkerHandler(processor: LambdaProcessor) {
  return async function handler(
    event: LambdaSqsEvent,
    context: LambdaRuntimeContext,
  ): Promise<LambdaSqsBatchResponse> {
    const controller = new AbortController();
    const abortDelay = Math.max(
      0,
      context.getRemainingTimeInMillis() - SHUTDOWN_SAFETY_MARGIN_MS,
    );
    const timeout = setTimeout(() => controller.abort(), abortDelay);

    try {
      return await processor.process(event, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };
}
