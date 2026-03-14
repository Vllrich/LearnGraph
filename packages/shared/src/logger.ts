type LogLevel = "debug" | "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const envLevel = process.env.LOG_LEVEL as string | undefined;
const MIN_LEVEL: LogLevel =
  envLevel && envLevel in LEVELS ? (envLevel as LogLevel) : (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

function format(level: LogLevel, module: string, message: string, meta?: LogMeta): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify({
      level,
      module,
      message,
      ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
      ts: new Date().toISOString(),
    });
  }

  const COLORS: Record<LogLevel, string> = {
    debug: "\x1b[90m",   // gray
    info:  "\x1b[36m",   // cyan
    warn:  "\x1b[33m",   // yellow
    error: "\x1b[31m",   // red
  };
  const RESET = "\x1b[0m";
  const DIM = "\x1b[2m";
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${DIM}${JSON.stringify(meta)}${RESET}` : "";
  return `${COLORS[level]}[${level.toUpperCase()}]${RESET} ${DIM}[${module}]${RESET} ${message}${metaStr}`;
}

function createLogger(module: string) {
  return {
    debug: (message: string, meta?: LogMeta) => {
      if (shouldLog("debug")) console.debug(format("debug", module, message, meta));
    },
    info: (message: string, meta?: LogMeta) => {
      if (shouldLog("info")) console.info(format("info", module, message, meta));
    },
    warn: (message: string, meta?: LogMeta) => {
      if (shouldLog("warn")) console.warn(format("warn", module, message, meta));
    },
    error: (message: string, meta?: LogMeta) => {
      if (shouldLog("error")) console.error(format("error", module, message, meta));
    },
  };
}

export { createLogger };
export type { LogLevel, LogMeta };
