import { serialize, deserialize, splitBuffer } from "./shared";

describe("shared", () => {
  describe("serialize()", () => {
    it("should prepend an T if the payload is a string", () => {
      expect(serialize("foo")).toEqual(Buffer.from("Tfoo"));
    });

    it("should prepend a J if the payload is JSON-stringified", () => {
      expect(serialize({})).toEqual(Buffer.from("J{}"));
      expect(serialize([])).toEqual(Buffer.from("J[]"));
      expect(serialize(null)).toEqual(Buffer.from("Jnull"));
      expect(serialize(0)).toEqual(Buffer.from("J0"));
    });

    it("should prepend a B if the payload is a buffer", () => {
      expect(serialize(Buffer.from("abc"))).toEqual(Buffer.from("Babc"));
    });
  });

  describe("deserialize", () => {
    it("should treat T-prefixed payloads as string", () => {
      expect(deserialize(Buffer.from("Tfoo"))).toEqual("foo");
    });

    it("should parse J-prefixed payloads with JSON.parse", () => {
      expect(deserialize(Buffer.from("J{}"))).toEqual({});
      expect(deserialize(Buffer.from("J[]"))).toEqual([]);
      expect(deserialize(Buffer.from("Jnull"))).toEqual(null);
      expect(deserialize(Buffer.from("J0"))).toEqual(0);
    });

    it("should treat B-prefixed payloads as Buffers", () => {
      expect(deserialize(Buffer.from("Babc"))).toEqual(Buffer.from("abc"));
    });
  });

  describe("splitBuffer()", () => {
    it("should split a buffer at a certain string from a certain offset", () => {
      expect(splitBuffer(Buffer.from("abc"), "b")).toEqual([
        Buffer.from("a"),
        Buffer.from("c"),
      ]);
      expect(splitBuffer(Buffer.from("abc"), "d")).toEqual([
        Buffer.from("abc"),
      ]);
      expect(splitBuffer(Buffer.from("abc"), "b", 1)).toEqual([
        Buffer.from("a"),
        Buffer.from("c"),
      ]);
      expect(splitBuffer(Buffer.from("abc"), "b", 2)).toEqual([
        Buffer.from("abc"),
      ]);
    });
  });
});
