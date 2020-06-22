import { NanoClient } from "./client";
import { NanoServer } from "./server";
import { RequestError } from "./error";

enum Errors {
  test,
}

enum Topics {
  test,
}

interface Api {
  [Topics.test]: {
    msg: { foo: string };
    push: { foo: string };
    req: { foo: string };
    res: { bar: string };
  };
}

describe("NanoServer + NanoClient", () => {
  let ns: NanoServer<Api>;
  let nc: NanoClient<Api>;

  describe("Unix", () => {
    beforeEach(async () => {
      ns = new NanoServer<Api>().listen("/tmp/lean-tcp-test");
      nc = new NanoClient<Api>("/tmp/lean-tcp-test");
      nc.connect();
    });

    afterEach(() => {
      nc.close();
      return new Promise((resolve) => ns.close(resolve));
    });

    describe("send()", () => {
      it("should send and receive a message", async () => {
        const result = new Promise((resolve) =>
          ns.onMessage(Topics.test, resolve)
        );
        await nc.send(Topics.test, { foo: "bar" });
        expect(await result).toEqual({ foo: "bar" });
      });
    });

    describe("request()", () => {
      it("should send a request and response message", async () => {
        ns.onRequest(Topics.test, (payload) => {
          expect(payload).toEqual({ foo: "bar" });
          return { bar: "baz" };
        });

        const response = await nc.request(Topics.test, { foo: "bar" });

        expect(response).toEqual({ bar: "baz" });
      });

      it("should correctly handle errors", async () => {
        expect.assertions(2);
        ns.onRequest(Topics.test, () => {
          throw new RequestError(Errors.test, "Test message");
        });

        try {
          await nc.request(Topics.test, { foo: "bar" });
        } catch (e) {
          expect(e.code).toEqual(Errors.test);
          expect(e.message).toEqual("Test message");
        }
      });
    });

    describe("subscribe()", () => {
      it("should register for multicast messages", async () => {
        const listener = jest.fn();

        await nc.subscribe(Topics.test, listener);
        await wait();
        await ns.push(Topics.test, { foo: "bar" });
        await wait();

        expect(listener).toHaveBeenCalledWith({ foo: "bar" });
      });

      it("should return an unsubscribe callback", async () => {
        const listener = jest.fn();
        const unsubscribe = await nc.subscribe(Topics.test, listener);
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
});

const wait = (delay = 3) =>
  new Promise((resolve) => setTimeout(resolve, delay));
