import { Server } from "net";
import { NanoClient } from "./client";
import { NanoServer } from "./server";
import { promisify } from "util";
import { RequestError } from "./error";

enum Errors {
  test,
}

enum Topics {
  test,
}

interface Api {
  [Topics.test]: {
    msg: {
      foo: "bar";
    };
    push: {
      foo: "bar";
    };
    req: {
      foo: "bar";
    };
    res: { bar: "baz" };
  };
}

describe("NanoServer + NanoClient", () => {
  let server: Server;
  let ns: NanoServer<Api>;
  let nc: NanoClient<Api>;

  beforeEach(async () => {
    server = new Server();
    await promisify(server.listen.bind(server))("/tmp/lean-tcp-test");
    ns = new NanoServer<Api>(server);
    nc = new NanoClient<Api>("/tmp/lean-tcp-test");
    ns.listen();
    nc.connect();
  });

  afterEach(() => {
    nc.close();
    return new Promise((resolve) => server.close(resolve));
  });

  describe("send()", () => {
    it("should send and receive a message", async () => {
      const result = new Promise((resolve) =>
        ns.onMessage(Topics.test, resolve, true)
      );
      await nc.send(Topics.test, { foo: "bar" });
      expect(await result).toEqual({ foo: "bar" });
    });
  });

  describe("request()", () => {
    it("should send a request and response message", async () => {
      ns.onRequest(
        Topics.test,
        (payload) => {
          expect(payload).toEqual({ foo: "bar" });
          return { bar: "baz" } as { bar: "baz" };
        },
        true
      );

      const response = await nc.request(Topics.test, { foo: "bar" }, true);

      expect(response).toEqual({ bar: "baz" });
    });

    it("should correctly handle errors", async () => {
      expect.assertions(2);
      ns.onRequest(
        Topics.test,
        () => {
          throw new RequestError(Errors.test, "Test message");
        },
        true
      );

      try {
        await nc.request(Topics.test, { foo: "bar" }, true);
      } catch (e) {
        expect(e.code).toEqual(Errors.test);
        expect(e.message).toEqual("Test message");
      }
    });
  });

  describe("subscribe()", () => {
    it("should register for multicast messages", async () => {
      const listener = jest.fn();

      await nc.subscribe(Topics.test, listener, true);
      await wait();
      await ns.push(Topics.test, { foo: "bar" });
      await wait();

      expect(listener).toHaveBeenCalledWith({ foo: "bar" });
    });

    it("should return an unsubscribe callback", async () => {
      const listener = jest.fn();
      const unsubscribe = await nc.subscribe(Topics.test, listener, true);
      await wait();

      await ns.push(Topics.test, { foo: "bar" });
      await wait();
      await unsubscribe();
      await ns.push(Topics.test, { foo: "bar" });
      await wait();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});

const wait = (delay = 3) =>
  new Promise((resolve) => setTimeout(resolve, delay));
