import { ListenOptions, Server } from "net";
import { BeamSocket } from "./socket";
import type { MessageHandler, RequestHandler, PushBody } from "./types";
import { deserialize, serialize, splitBuffer } from "./shared";

export class BeamServer<T> {
  private sockets: BeamSocket[] = [];
  private subscriptions: { [topic in number | string]: Set<BeamSocket> } = {};
  private messageHandlers: {
    [topic in number | string]: Set<(payload: any) => void>;
  } = {};
  private requestHandlers: {
    [topic in number | string]: RequestHandler<any, any>;
  } = {};

  constructor(private server = new Server()) {
    this.server.on("connection", (s) => {
      const socket = new BeamSocket(s);
      socket.on("message", async (message: Buffer) => {
        let split1: Buffer;
        const type = String.fromCharCode(message[0]);
        [split1, message] = splitBuffer(message.slice(1), "|");
        const topic = split1.toString();
        switch (type) {
          case "+":
            this.subscriptions[topic] = this.subscriptions[topic] || new Set();
            this.subscriptions[topic].add(socket);
            break;
          case "-":
            this.subscriptions[topic].delete(socket);
            if (this.subscriptions[topic].size === 0) {
              delete this.subscriptions[topic];
            }
            break;
          case "!":
            this.messageHandlers[topic]?.forEach((handler) =>
              handler(message && deserialize(message))
            );
            break;
          case "?":
            [split1, message] = splitBuffer(message, "|");
            try {
              const result = await this.requestHandlers[topic]?.(
                message && deserialize(message)
              );
              socket.send(
                Buffer.concat([
                  Buffer.from(`.${split1}`),
                  ...(result !== null && result !== undefined
                    ? [Buffer.from("|"), serialize(result)]
                    : []),
                ])
              );
            } catch (e) {
              socket.send(`X${split1}|${e.code}|${e.message}`);
            }
        }
      });
      this.sockets.push(socket);
    });
  }

  listen(
    port?: number,
    hostname?: string,
    backlog?: number,
    listeningListener?: () => void
  ): this;
  listen(
    port?: number,
    hostname?: string,
    listeningListener?: () => void
  ): this;
  listen(port?: number, backlog?: number, listeningListener?: () => void): this;
  listen(port?: number, listeningListener?: () => void): this;
  listen(path: string, backlog?: number, listeningListener?: () => void): this;
  listen(path: string, listeningListener?: () => void): this;
  listen(options: ListenOptions, listeningListener?: () => void): this;
  listen(handle: any, backlog?: number, listeningListener?: () => void): this;
  listen(handle: any, listeningListener?: () => void): this;
  listen(...args: any[]) {
    this.server.listen(...args);
    return this;
  }

  close(callback?: (err?: Error) => void) {
    this.server.close(callback);
    return this;
  }

  push<K extends keyof T>(
    topic: K,
    ...[payload]: PushBody<K, T> extends void ? [] : [PushBody<K, T>]
  ) {
    return Promise.all(
      this.sockets.map((socket) =>
        socket.send(`!${topic}|${serialize(payload)}`)
      )
    );
  }

  onMessage<K extends keyof T>(topic: K, handler: MessageHandler<K, T>) {
    const handlers =
      this.messageHandlers[topic as number | string] || new Set();
    this.messageHandlers[topic as number | string] = handlers;
    handlers.add(handler);
    return this;
  }

  onRequest<K extends keyof T>(topic: K, handler: RequestHandler<K, T>) {
    this.requestHandlers[topic as number | string] = handler;
    return this;
  }
}

export function createServer<T>(server?: Server) {
  return new BeamServer<T>(server);
}
