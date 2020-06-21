import { ListenOptions, Server } from "net";
import { NanoSocket } from "./socket";
import type { MessageHandler, RequestHandler, PushBody } from "./types";
import { deserializePayload, serializePayload } from "./shared";

export class NanoServer<T> {
  private sockets: NanoSocket[] = [];
  private subscriptions: { [topic in number | string]: Set<NanoSocket> } = {};
  private messageHandlers: {
    [topic in number | string]: Set<(payload: any) => void>;
  } = {};
  private requestHandlers: {
    [topic in number | string]: RequestHandler<any, any>;
  } = {};

  constructor(private server = new Server()) {
    this.server.on("connection", (s) => {
      const socket = new NanoSocket(s);
      socket.on("message", async (message: string) => {
        const type = message[0];
        const tokens = message.substr(1).split("|");
        const topic = tokens[0];
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
              handler(deserializePayload(tokens[1]))
            );
            break;
          case "?":
            try {
              const result = await this.requestHandlers[topic]?.(
                deserializePayload(tokens[2])
              );
              socket.send(`.${tokens[1]}|${serializePayload(result)}`);
            } catch (e) {
              socket.send(`X${tokens[1]}|${e.code}|${e.message}`);
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
        socket.send(`!${topic}|${serializePayload(payload)}`)
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
