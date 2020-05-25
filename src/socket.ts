import { EventEmitter } from "events";
import { Socket } from "net";
import { promisify } from "util";

export class NanoSocket extends EventEmitter {
  private buffered = "";
  private write = promisify(this.socket.write.bind(this.socket));

  constructor(public socket: Socket) {
    super();
    this.attachEventListeners();
  }

  async send(message: string) {
    await this.waitForConnection();
    await this.write(`${message}§$§`);
  }

  private async attachEventListeners() {
    this.socket.on("data", (data) => {
      const chunks = data.toString().split("§$§");
      if (chunks.length > 1) {
        const complete = [this.buffered + chunks[0], ...chunks.slice(1, -1)];
        complete.forEach((message) => {
          this.emit("message", message);
        });
        this.buffered = chunks[chunks.length - 1];
      } else {
        this.buffered += data;
      }
    });
  }

  private waitForConnection() {
    return this.socket.connecting
      ? new Promise((resolve) => this.socket.once("connect", resolve))
      : Promise.resolve();
  }
}
