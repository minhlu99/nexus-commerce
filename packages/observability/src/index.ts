import { env } from "@nexus/env";
import {
  type Context,
  context,
  propagation,
  type Span,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

let isInitialized = false;

/**
 * Initialize OpenTelemetry tracer provider and OTLP exporter for Jaeger
 */
export function initTelemetry(serviceName: string) {
  if (isInitialized) {
    return {
      tracer: trace.getTracer(serviceName),
      shutdown: async () => {},
    };
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
  });

  const exporter = new OTLPTraceExporter({
    url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  const provider = new NodeTracerProvider({
    resource,
  });

  // Use BatchSpanProcessor for non-blocking asynchronous span buffering
  // Eliminates event loop contention during high-concurrency spikes (p99 ~175ms)
  const spanProcessor =
    process.env.OTEL_USE_SIMPLE_SPAN_PROCESSOR === "true"
      ? new SimpleSpanProcessor(exporter)
      : new BatchSpanProcessor(exporter, {
          maxQueueSize: 4096,
          scheduledDelayMillis: 500,
          maxExportBatchSize: 512,
        });

  provider.addSpanProcessor(spanProcessor);

  // Configure W3C Trace Context propagator
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  // Register provider globally with OpenTelemetry API
  provider.register();

  isInitialized = true;

  console.log(
    `📡 OpenTelemetry initialized for "${serviceName}" -> ${env.OTEL_EXPORTER_OTLP_ENDPOINT}`,
  );

  return {
    tracer: trace.getTracer(serviceName),
    shutdown: async () => {
      await provider.shutdown();
      isInitialized = false;
    },
  };
}

/**
 * Wraps an async function in an active OpenTelemetry span
 */
export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>,
): Promise<T>;
export async function withSpan<T>(
  name: string,
  attributesOrFn: Record<string, string | number | boolean> | ((span: Span) => Promise<T>),
  maybeFn?: (span: Span) => Promise<T>,
): Promise<T> {
  const attributes = typeof attributesOrFn === "object" ? attributesOrFn : undefined;
  const fn = typeof attributesOrFn === "function" ? attributesOrFn : maybeFn!;
  const tracer = trace.getTracer("nexus");

  return tracer.startActiveSpan(name, async (span) => {
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
    }

    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) {
        span.recordException(error);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Injects the active trace context into a carrier dictionary (e.g. outbox payload or headers)
 */
export function injectTraceContext(carrier: Record<string, unknown> = {}): Record<string, unknown> {
  propagation.inject(context.active(), carrier);
  return carrier;
}

/**
 * Extracts a parent trace context from a carrier and wraps an async execution as a child span
 * Enables asynchronous cross-process distributed tracing across outbox rows & queues
 */
export async function withParentSpan<T>(
  name: string,
  carrier: Record<string, unknown> | undefined,
  fn: (span: Span) => Promise<T>,
): Promise<T>;
export async function withParentSpan<T>(
  name: string,
  carrier: Record<string, unknown> | undefined,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>,
): Promise<T>;
export async function withParentSpan<T>(
  name: string,
  carrier: Record<string, unknown> | undefined,
  attributesOrFn: Record<string, string | number | boolean> | ((span: Span) => Promise<T>),
  maybeFn?: (span: Span) => Promise<T>,
): Promise<T> {
  const attributes = typeof attributesOrFn === "object" ? attributesOrFn : undefined;
  const fn = typeof attributesOrFn === "function" ? attributesOrFn : maybeFn!;

  const parentContext: Context = carrier
    ? propagation.extract(context.active(), carrier)
    : context.active();

  return context.with(parentContext, () => {
    return attributes ? withSpan(name, attributes, fn) : withSpan(name, fn);
  });
}

export { context, propagation, type Span, SpanStatusCode, trace };
