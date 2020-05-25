import { Server } from "net";
import { NanoSocket } from "./socket";
import { MessageHandler, RequestHandler, PushBody, MessageBody } from "./types";

export class NanoServer<T> {
  private sockets: NanoSocket[] = [];
  private subscriptions: { [topic in number | string]: Set<NanoSocket> } = {};
  private server: Server;
  private messageHandlers: {
    [topic in number | string]: Set<(payload: string) => void>;
  } = {};
  private requestHandlers: {
    [topic in number | string]: RequestHandler<any, any>;
  } = {};

  constructor(server: Server) {
    this.server = server;
  }

  push<K extends keyof T>(
    topic: K,
    ...[payload]: PushBody<K, T> extends void ? [] : [PushBody<K, T>]
  ) {
    return Promise.all(
      this.sockets.map((socket) =>
        socket.send(
          `!${topic}|${
            typeof payload === "string" ? payload : JSON.stringify(payload)
          }`
        )
      )
    );
  }

  onMessage<K extends keyof T>(
    topic: K,
    handler: MessageHandler<K, T>,
    ...[parse]: MessageBody<K, T> extends string | void ? [] : [true]
  ) {
    const handlers =
      this.messageHandlers[topic as number | string] || new Set();
    this.messageHandlers[topic as number | string] = handlers;
    const fn: (payload: string) => void = parse
      ? (payload) => handler(JSON.parse(payload))
      : (handler as any);
    handlers.add(fn);
    return () => {
      handlers.delete(fn);
      if (handlers.size === 0) {
        delete this.messageHandlers[topic as number | string];
      }
    };
  }

  onRequest<K extends keyof T>(
    topic: K,
    handler: RequestHandler<K, T>,
    ...[parse]: MessageBody<K, T> extends string | void ? [] : [true]
  ) {
    const fn = parse
      ? (payload: string) => handler(JSON.parse(payload))
      : (handler as any);
    this.requestHandlers[topic as number | string] = fn;
    return () => {
      delete this.requestHandlers[topic as number | string];
    };
  }

  listen() {
    this.server.on("connection", (s) => {
      const socket = new NanoSocket(s);
      socket.on("message", async (message: string) => {
        const type = message[0];
        const idx1 = message.indexOf("|", 2);
        const topic = message.substring(1, idx1 > 0 ? idx1 : undefined);
        switch (type) {
          case "+": {
            this.subscriptions[topic] = this.subscriptions[topic] || new Set();
            this.subscriptions[topic].add(socket);
            break;
          }
          case "-": {
            this.subscriptions[topic].delete(socket);
            if (this.subscriptions[topic].size === 0) {
              delete this.subscriptions[topic];
            }
            break;
          }
          case "!": {
            const payload = message.substr(idx1 + 1);
            this.messageHandlers[topic]?.forEach((handler) => handler(payload));
            break;
          }
          case "?": {
            const idx2 = message.indexOf("|", idx1 + 2);
            const requestId = Number(message.substring(idx1 + 1, idx2));
            const payload = message.substr(idx2 + 1);
            // TODO: Error handling
            try {
              const result = await this.requestHandlers[topic]?.(payload);
              const responsePayload =
                typeof result === "string" ? result : JSON.stringify(result);
              socket.send(`.${requestId}|${responsePayload}`);
            } catch (e) {
              socket.send(`X${requestId}|${e.code}|${e.message}`);
            }
          }
        }
      });
      this.sockets.push(socket);
    });
  }
}
