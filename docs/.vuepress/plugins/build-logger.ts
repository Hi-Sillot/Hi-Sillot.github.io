import fs from "node:fs";
import path from "node:path";

const LOG_FILE_NAME = "plugin-build.log";

class BuildLoggerManager {
  private static instance: BuildLoggerManager | null = null;
  private logStream: fs.WriteStream | null = null;
  private buffer: string[] = [];
  private logFilePath: string = "";
  private initialized = false;

  private constructor() {
    this.logFilePath = path.resolve(process.cwd(), "docs", ".vuepress", LOG_FILE_NAME);
    this.initStream();
  }

  private initStream() {
    try {
      const dir = path.dirname(this.logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.logStream = fs.createWriteStream(this.logFilePath, { flags: "w" });
      this.initialized = true;
      for (const line of this.buffer) {
        this.logStream.write(line + "\n");
      }
      this.buffer = [];
    } catch {
      // 无法创建日志文件时回退到缓冲区
    }
  }

  static getInstance(): BuildLoggerManager {
    if (!BuildLoggerManager.instance) {
      BuildLoggerManager.instance = new BuildLoggerManager();
    }
    return BuildLoggerManager.instance;
  }

  write(level: string, tag: string, message: string, args: any[]) {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    const argsStr =
      args.length > 0
        ? " " +
          args
            .map((a) =>
              typeof a === "object" ? JSON.stringify(a) : String(a),
            )
            .join(" ")
        : "";
    const line = `[${timestamp}] [${level}] [${tag}] ${message}${argsStr}`;

    if (this.logStream) {
      this.logStream.write(line + "\n");
    } else {
      this.buffer.push(line);
    }
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }

  close() {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}

export class BuildLogger {
  private tag: string;
  private manager: BuildLoggerManager;

  constructor(tag: string) {
    this.tag = tag;
    this.manager = BuildLoggerManager.getInstance();
  }

  log(message: string, ...args: any[]) {
    this.manager.write("INFO", this.tag, message, args);
  }

  warn(message: string, ...args: any[]) {
    this.manager.write("WARN", this.tag, message, args);
  }

  error(message: string, ...args: any[]) {
    this.manager.write("ERROR", this.tag, message, args);
    // 错误仍然输出到控制台，确保 CI 能检测到构建失败
    console.error(`[${this.tag}] ${message}`, ...args);
  }

  static getLogFilePath(): string {
    return BuildLoggerManager.getInstance().getLogFilePath();
  }

  static close() {
    BuildLoggerManager.getInstance().close();
  }
}
