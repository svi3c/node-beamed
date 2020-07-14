import { EventEmitter } from "events";
import { BeamSocket } from "./socket";
import { Socket } from "net";

describe("BeamSocket", () => {
  let socket: jest.Mocked<Socket>;
  let bs: BeamSocket;

  beforeEach(() => {
    socket = Object.assign(new EventEmitter(), {
      pending: false,
      write: jest.fn().mockImplementation((_, cb) => cb()),
    }) as any;
    bs = new BeamSocket(socket as any);
  });

  describe("send()", () => {
    it("should write a message with delimiter to the underlying socket", async () => {
      await bs.send("Message");
      expect(socket.write).toHaveBeenCalledWith(
        Buffer.from("7Message"),
        expect.any(Function)
      );
    });
  });

  describe("events", () => {
    describe("message", () => {
      it("should be emitted if a message is finished", () => {
        const fn = jest.fn();
        bs.on("message", fn);
        socket.emit("data", Buffer.from("6abc"));
        expect(fn).not.toHaveBeenCalled();
        socket.emit("data", Buffer.from(`def4ghi`));
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(Buffer.from("abcdef"));
        socket.emit("data", Buffer.from("j"));
        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenCalledWith(Buffer.from("ghij"));
      });
    });
  });
});
