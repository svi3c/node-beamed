import { EventEmitter } from "events";
import { Socket } from "net";
import { promisify } from "util";
import { DELIMITER } from "./shared";

export class BeamSocket<S extends Socket = Socket> extends EventEmitter {
  private buffered = "";
  private _socket?: S;

  get socket() {
    return this._socket;
  }
  set socket(socket: S | undefined) {
    if (socket !== this._socket) {
      this._removeEventListeners();
      this._socket = socket;
      this._attachEventListeners();
      if (!(socket as any).pending) {
        this.connectListener();
      }
    }
  }

  constructor(socket?: S) {
    super();
    if (socket) {
      this.socket = socket;
    }
  }

  async send(message: string) {
    await this.waitForConnection();
    await promisify(this.socket!.write.bind(this.socket))(
      `${message}${DELIMITER}`
    );
  }

  private async _attachEventListeners() {
    this.socket!.on("data", this.dataListener).on(
      "connect",
      this.connectListener
    );
  }

  private async _removeEventListeners() {
    this.socket
      ?.off("data", this.dataListener)
      .off("connect", this.connectListener);
  }

  private dataListener = (data: Buffer) => {
    const chunks = data.toString().split(DELIMITER);
    if (chunks.length > 1) {
      const complete = [this.buffered + chunks[0], ...chunks.slice(1, -1)];
      complete.forEach((message) => {
        this.emit("message", message);
      });
      this.buffered = chunks[chunks.length - 1];
    } else {
      this.buffered += data;
    }
  };

  private connectListener = () => this.emit("connect");

  private waitForConnection() {
    return (this.socket as any)?.pending
      ? new Promise((resolve) => this.once("connect", resolve))
      : Promise.resolve();
  }
}
