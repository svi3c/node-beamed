import { EventEmitter } from "events";
import { Socket } from "net";
import { NanoSocket } from "./socket";
import type {
  MessageBody,
  RequestParams,
  ResponseBody,
  MessageHandler,
} from "./types";
import { RequestError } from "./error";
import { serializePayload, deserializePayload } from "./shared";

export class NanoClient<T> extends EventEmitter {
  private nextRequestId = 1;
  private socket: NanoSocket;
  private retryCount = 0;
  private target: string | { host?: string; port: number };
  private requests: {
    [id in number]: (success: boolean, payload: string) => void;
  } = {};
  private messageHandlers: {
    [topic in number | string]: Set<MessageHandler<any, any>>;
  } = {};
  private closed = true;
  private reconnectTimeout?: NodeJS.Timeout;

  constructor(
    target: string | { host?: string; port: number },
    {
      reconnect = 1000,
    }: {
      reconnect?: number | ((count: number) => number);
    } = {}
  ) {
    super();
    const socket = new Socket();
    this.socket = new NanoSocket(socket);
    this.target = target;
    this.socket.on("message", (message: string) => {
      const idx = message.indexOf("|", 2);
      const type = message[0];
      const topicOrRequestId = message.substring(1, idx);
      const payload = message.substr(idx + 1);
      switch (type) {
        case "X":
        case ".": {
          const requestId = Number(topicOrRequestId);
          this.requests[requestId](type === ".", payload);
          delete this.requests[requestId];
          break;
        }
        case "!": {
          this.messageHandlers[topicOrRequestId]?.forEach((handler) =>
            handler(deserializePayload(payload))
          );
        }
      }
    });
    if (reconnect) {
      socket.on("close", () => {
        if (!this.closed) {
          this.reconnectTimeout = setTimeout(
            () => this.connect(),
            typeof reconnect === "number"
              ? reconnect
              : reconnect(this.retryCount++)
          );
        }
      });
    }
    socket.on("error", (e) => {
      console.warn(`Error connecting to ${this.target}`);
      console.warn(e.stack || e);
      this.emit("error", e);
    });
  }

  send<K extends keyof T>(
    topic: K,
    ...[payload]: MessageBody<K, T> extends void ? [] : [MessageBody<K, T>]
  ) {
    return this.socket.send(`!${topic}|${serializePayload(payload)}`);
  }

  async request<K extends keyof T>(
    topic: K,
    ...[payload]: RequestParams<K, T>
  ): Promise<ResponseBody<K, T>> {
    const requestId = this.nextRequestId++;
    return (
      await Promise.all([
        new Promise<any>((resolve, reject) => {
          this.requests[requestId] = (success: boolean, payload: any) => {
            if (success) {
              resolve(deserializePayload(payload));
            } else {
              const idx = payload.indexOf("|");
              const code = payload.substr(0, idx);
              reject(
                new RequestError(
                  isNaN(Number(code)) ? code : Number(code),
                  payload.substr(idx + 1)
                )
              );
            }
          };
        }),
        this.socket.send(`?${topic}|${requestId}|${serializePayload(payload)}`),
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
      await this.socket.send(`+${topic}|${requestId}`);
    }
    return async () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        delete this.messageHandlers[topic as number | string];
        await this.socket.send(`-${topic}`);
      }
    };
  }

  connect() {
    this.emit("connecting");
    const socket = this.socket.socket;
    this.closed = false;
    if (typeof this.target === "string") {
      socket.connect(this.target);
    } else {
      socket.connect(this.target.port, this.target.host!);
    }
    return this;
  }

  async close() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.closed = true;
    this.socket.socket.end();
  }
}
