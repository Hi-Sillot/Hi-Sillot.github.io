// utils/debug.ts
class Debugger {
  private static instance: Debugger;
  private enabled: boolean = true;
  private tagColors: Map<string, string> = new Map();
  private colorIndex: number = 0;
  private colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FECA57",
    "#FF9FF3",
    "#54A0FF",
    "#5F27CD",
    "#00D2D3",
    "#FF9F43",
  ];

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

  private getTagColor(tag: string): string {
    if (!this.tagColors.has(tag)) {
      this.tagColors.set(
        tag,
        this.colors[this.colorIndex % this.colors.length],
      );
      this.colorIndex++;
    }
    return this.tagColors.get(tag)!;
  }

  log(tag: string, step: string, data?: any): void {
    if (!this.enabled) return;

    const color = this.getTagColor(tag);
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];

    console.log(
      `%c[${timestamp}] %c${tag}%c: ${step}`,
      "color: #666;",
      `color: ${color}; font-weight: bold;`,
      "color: inherit;",
      data !== undefined ? data : "",
    );
  }

  error(tag: string, message: string, error?: any): void {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    console.error(
      `%c[${timestamp}] %c${tag}%c: ERROR - ${message}`,
      "color: #666;",
      "color: #FF6B6B; font-weight: bold;",
      "color: #FF6B6B;",
      error || "",
    );
  }

  warn(tag: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    console.warn(
      `%c[${timestamp}] %c${tag}%c: WARN - ${message}`,
      "color: #666;",
      "color: #FECA57; font-weight: bold;",
      "color: inherit;",
      data || "",
    );
  }

  table(tag: string, data: any, title?: string): void {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(
      `%c[${timestamp}] %c${tag}%c: ${title || "TABLE DATA"}`,
      "color: #666;",
      `color: ${this.getTagColor(tag)}; font-weight: bold;`,
      "color: inherit;",
    );
    console.table(data);
  }
}

export const debug = Debugger.getInstance();
