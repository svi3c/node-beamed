import { EventEmitter } from "events";
import { BeamSocket } from "./socket";
import { Socket } from "net";
import { DELIMITER } from "./shared";

describe("BeamSocket", () => {
  let socket: jest.Mocked<Socket>;
  let bs: BeamSocket;

  beforeEach(() => {
    socket = Object.assign(new EventEmitter(), {
      connecting: false,
      write: jest.fn().mockImplementation((_, cb) => cb()),
    }) as any;
    bs = new BeamSocket(socket as any);
  });

  describe("send()", () => {
    it("should write a message with delimiter to the underlying socket", async () => {
      await bs.send("Message");
      expect(socket.write).toHaveBeenCalledWith(
        `Message${DELIMITER}`,
        expect.any(Function)
      );
    });
  });

  describe("events", () => {
    describe("message", () => {
      it("should be emitted if a message is finished", () => {
        const fn = jest.fn();
        bs.on("message", fn);
        socket.emit("data", Buffer.from("abc"));
        expect(fn).not.toHaveBeenCalled();
        socket.emit("data", Buffer.from(`def${DELIMITER}ghi`));
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith("abcdef");
        socket.emit("data", DELIMITER);
        expect(fn).toHaveBeenCalledTimes(2);
        expect(fn).toHaveBeenCalledWith("ghi");
      });
    });
  });
});
