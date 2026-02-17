type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEvent {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: error };
}

export function logEvent({ level, message, context = {} }: LogEvent) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    context,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  if (level === "debug") {
    console.debug(line);
    return;
  }

  console.info(line);
}

export function setupGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    logEvent({
      level: "error",
      message: "uncaught_error",
      context: {
        file: event.filename,
        line: event.lineno,
        column: event.colno,
        error: normalizeError(event.error),
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logEvent({
      level: "error",
      message: "unhandled_rejection",
      context: {
        reason: normalizeError(event.reason),
      },
    });
  });
}
