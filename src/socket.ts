import { EventEmitter } from "events";
import { Socket } from "net";
import { promisify } from "util";

export class BeamSocket<S extends Socket = Socket> extends EventEmitter {
  private _buffered: Buffer[] = [];
  private _remainingBytes = 0;
  private _socket?: S;

  get socket() {
    return this._socket;
  }
  set socket(socket: S | undefined) {
    if (socket !== this._socket) {
      this._removeEventListeners();
      this._socket = socket;
      this._attachEventListeners();
      if (socket && !(socket as any).pending) {
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

  async send(message: Buffer | string) {
    await this.waitForConnection();
    await promisify(this.socket!.write.bind(this.socket))(
      Buffer.concat([
        Buffer.from(message.length.toString()),
        Buffer.from(message),
      ])
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
    while (data.length > 0) {
      if (this._remainingBytes === 0) {
        [this._remainingBytes, data] = readByteLength(data);
      }
      let part = data.slice(0, this._remainingBytes);
      this._buffered.push(part);
      this._remainingBytes -= part.length;
      data = data.slice(part.length);
      if (this._remainingBytes === 0) {
        this.emit("message", Buffer.concat(this._buffered));
        this._buffered = [];
      }
    }
  };

  private connectListener = () => this.emit("connect");

  private waitForConnection() {
    return (this.socket as any)?.pending
      ? new Promise((resolve) => this.once("connect", resolve))
      : Promise.resolve();
  }
}

const readByteLength = (data: Buffer) => {
  let i = 0,
    length = 0;
  for (let x = data[i]; x >= 0x30 && x <= 0x39; i++, x = data[i]) {
    length = length * 10 + x - 0x30;
  }
  return [length, data.slice(i)] as [number, Buffer];
};
