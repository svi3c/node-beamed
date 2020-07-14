import { EventEmitter } from "events";
import { Socket, SocketConnectOpts } from "net";
import { ConnectionOptions, TLSSocket, connect as connectTls } from "tls";
import { BeamSocket } from "./socket";
import type {
  MessageBody,
  RequestParams,
  ResponseBody,
  MessageHandler,
  Reconnect,
  ClientOpts,
} from "./types";
import { BeamError } from "./error";
import { serialize, deserialize, splitBuffer } from "./shared";

export class BeamClient<T, S extends Socket = Socket> extends EventEmitter {
  private nextRequestId = 1;
  private bsock: BeamSocket<S>;
  private retryCount = 0;
  private requests: {
    [id in number]: (success: boolean, payload: Buffer) => void;
  } = {};
  private messageHandlers: {
    [topic in number | string]: Set<MessageHandler<any, any>>;
  } = {};
  private closed = true;
  private reconnectTimeout?: NodeJS.Timeout;
  private reconnect?: Reconnect;

  constructor(
    private _connect: (socket?: S) => S,
    { reconnect = 1000 }: ClientOpts = {}
  ) {
    super();
    this.reconnect = reconnect;
    this.bsock = new BeamSocket<S>();
    this.bsock.on("message", (message: Buffer) => {
      let split1: Buffer;
      const type = String.fromCharCode(message[0]);
      [split1, message] = splitBuffer(message.slice(1), "|", 1);
      const topicOrRequestId = split1.toString();
      switch (type) {
        case "X":
        case ".": {
          const requestId = Number(topicOrRequestId);
          this.requests[requestId](type === ".", message);
          delete this.requests[requestId];
          break;
        }
        case "!": {
          this.messageHandlers[topicOrRequestId]?.forEach((handler) =>
            handler(message && deserialize(message))
          );
        }
      }
    });
  }

  send<K extends keyof T>(
    topic: K,
    ...[payload]: MessageBody<K, T> extends void ? [] : [MessageBody<K, T>]
  ) {
    return this.bsock.send(`!${topic}|${serialize(payload)}`);
  }

  async request<K extends keyof T>(
    topic: K,
    ...[payload]: RequestParams<K, T>
  ): Promise<ResponseBody<K, T>> {
    const requestId = this.nextRequestId++;
    return (
      await Promise.all([
        new Promise<any>((resolve, reject) => {
          this.requests[requestId] = (success: boolean, payload: Buffer) => {
            if (success) {
              resolve(deserialize(payload));
            } else {
              let split1: Buffer;
              [split1, payload] = splitBuffer(payload, "|", 1);
              const code = split1.toString();
              reject(
                new BeamError(
                  isNaN(Number(code)) ? code : Number(code),
                  payload.toString()
                )
              );
            }
          };
        }),
        this.bsock.send(`?${topic}|${requestId}|${serialize(payload)}`),
      ])
    )[0];
  }

  async subscribe<K extends keyof T>(topic: K, handler: MessageHandler<K, T>) {
    const handlers =
      this.messageHandlers[topic as number | string] || new Set();
    this.messageHandlers[topic as number | string] = handlers;
    handlers.add(handler);
    const requestId = this.nextRequestId++;
    if (handlers.size === 1) {
      await this.bsock.send(`+${topic}|${requestId}`);
    }
    return async () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        delete this.messageHandlers[topic as number | string];
        await this.bsock.send(`-${topic}`);
      }
    };
  }

  connect() {
    this.closed = false;
    const socket = this._connect(this.bsock.socket);
    if (socket !== this.bsock.socket) {
      if (this.reconnect) {
        this.bsock.socket?.off("close", this.closeHandler);
        socket.on("close", this.closeHandler);
      }
      this.bsock.socket?.off("error", this.errorHandler);
      socket.on("error", this.errorHandler);
    }
    this.bsock.socket = socket;
    return this;
  }

  private closeHandler = () => {
    if (!this.closed) {
      this.reconnectTimeout = setTimeout(
        () => this.connect(),
        typeof this.reconnect === "number"
          ? this.reconnect
          : (this.reconnect as any)(this.retryCount++)
      );
    }
  };

  private errorHandler = (e: Error) => {
    console.warn(e.stack || e);
    this.emit("error", e);
  };

  async close() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.closed = true;
    this.bsock.socket?.end();
  }
}

export function createClient<T>(
  opts: string | SocketConnectOpts
): BeamClient<T, Socket>;
export function createClient<T>(
  opts: ConnectionOptions & { port: number; tls: true }
): BeamClient<T, TLSSocket>;
export function createClient<T>(opts: any) {
  return typeof opts === "object" && "tls" in opts
    ? new BeamClient<T, TLSSocket>((s = connectTls(opts)) =>
        s.connecting ? s : s.connect(opts)
      )
    : new BeamClient<T, Socket>((s = new Socket()) => s.connect(opts));
}

export function connect<T>(
  opts: string | SocketConnectOpts
): BeamClient<T, Socket>;
export function connect<T>(
  opts: ConnectionOptions & { port: number; tls: true }
): BeamClient<T, TLSSocket>;
export function connect(opts: any): any {
  return createClient(opts).connect();
}
