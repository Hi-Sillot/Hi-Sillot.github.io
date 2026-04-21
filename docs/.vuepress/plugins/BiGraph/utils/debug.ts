// utils/debug.ts
import { BuildLogger } from "../../build-logger";

const buildLogger = new BuildLogger("BiGraph");

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
    buildLogger.log(`[${tag}] ${msg}`);
  }

  error(tag: string, message: string, error?: any): void {
    const msg = error ? `${message} ${typeof error === "object" ? JSON.stringify(error) : String(error)}` : message;
    buildLogger.error(`[${tag}] ${msg}`);
  }

  warn(tag: string, message: string, data?: any): void {
    const msg = data ? `${message} ${typeof data === "object" ? JSON.stringify(data) : String(data)}` : message;
    buildLogger.warn(`[${tag}] ${msg}`);
  }

  table(tag: string, data: any, title?: string): void {
    if (!this.enabled) return;
    buildLogger.log(`[${tag}] ${title || "TABLE DATA"} ${typeof data === "object" ? JSON.stringify(data) : String(data)}`);
  }
}

export const debug = Debugger.getInstance();
