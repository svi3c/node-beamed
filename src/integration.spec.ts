import { BeamClient } from "./client";
import { BeamServer } from "./server";
import { BeamError } from "./error";

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

describe("BeamServer + BeamClient", () => {
  let bs: BeamServer<Api>;
  let bc: BeamClient<Api>;

  describe("Unix", () => {
    beforeEach(async () => {
      bs = new BeamServer<Api>().listen("/tmp/lean-tcp-test");
      bc = new BeamClient<Api>("/tmp/lean-tcp-test");
      bc.connect();
    });

    afterEach(() => {
      bc.close();
      return new Promise((resolve) => bs.close(resolve));
    });

    describe("send()", () => {
      it("should send and receive a message", async () => {
        const result = new Promise((resolve) =>
          bs.onMessage(Topics.test, resolve)
        );
        await bc.send(Topics.test, { foo: "bar" });
        expect(await result).toEqual({ foo: "bar" });
      });
    });

    describe("request()", () => {
      it("should send a request and response message", async () => {
        bs.onRequest(Topics.test, (payload) => {
          expect(payload).toEqual({ foo: "bar" });
          return { bar: "baz" };
        });

        const response = await bc.request(Topics.test, { foo: "bar" });

        expect(response).toEqual({ bar: "baz" });
      });

      it("should correctly handle errors", async () => {
        expect.assertions(2);
        bs.onRequest(Topics.test, () => {
          throw new BeamError(Errors.test, "Test message");
        });

        try {
          await bc.request(Topics.test, { foo: "bar" });
        } catch (e) {
          expect(e.code).toEqual(Errors.test);
          expect(e.message).toEqual("Test message");
        }
      });
    });

    describe("subscribe()", () => {
      it("should register for multicast messages", async () => {
        const listener = jest.fn();

        await bc.subscribe(Topics.test, listener);
        await wait();
        await bs.push(Topics.test, { foo: "bar" });
        await wait();

        expect(listener).toHaveBeenCalledWith({ foo: "bar" });
      });

      it("should return an unsubscribe callback", async () => {
        const listener = jest.fn();
        const unsubscribe = await bc.subscribe(Topics.test, listener);
        await wait();

        await bs.push(Topics.test, { foo: "bar" });
        await wait();
        await unsubscribe();
        await bs.push(Topics.test, { foo: "bar" });
        await wait();

        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });
});

const wait = (delay = 3) =>
  new Promise((resolve) => setTimeout(resolve, delay));
