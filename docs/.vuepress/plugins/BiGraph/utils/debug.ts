// utils/debug.ts

const isNode = typeof process !== "undefined" && !!process.versions?.node;

interface Logger {
  log(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

let buildLogger: Logger | null = null;

async function getBuildLogger(): Promise<Logger> {
  if (buildLogger) return buildLogger;
  if (!isNode) {
    buildLogger = console;
    return buildLogger;
  }
  try {
    const { BuildLogger } = await import("../../build-logger");
    buildLogger = new BuildLogger("BiGraph");
  } catch {
    buildLogger = console;
  }
  return buildLogger;
}

class Debugger {
  private static instance: Debugger;
  private enabled: boolean = true;

  static getInstance(): Debugger {
    if (!Debugger.instance) {
      Debugger.instance = new Debugger();
    }
    return Debugger.instance;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  log(tag: string, step: string, data?: any): void {
    if (!this.enabled) return;
    const msg = data !== undefined ? `${step} ${typeof data === "object" ? JSON.stringify(data) : String(data)}` : step;
    getBuildLogger().then((logger) => logger.log(`[${tag}] ${msg}`));
  }

  error(tag: string, message: string, error?: any): void {
    const msg = error ? `${message} ${typeof error === "object" ? JSON.stringify(error) : String(error)}` : message;
    getBuildLogger().then((logger) => logger.error(`[${tag}] ${msg}`));
  }

  warn(tag: string, message: string, data?: any): void {
    const msg = data ? `${message} ${typeof data === "object" ? JSON.stringify(data) : String(data)}` : message;
    getBuildLogger().then((logger) => logger.warn(`[${tag}] ${msg}`));
  }

  table(tag: string, data: any, title?: string): void {
    if (!this.enabled) return;
    getBuildLogger().then((logger) => logger.log(`[${tag}] ${title || "TABLE DATA"} ${typeof data === "object" ? JSON.stringify(data) : String(data)}`));
  }
}

export const debug = Debugger.getInstance();
