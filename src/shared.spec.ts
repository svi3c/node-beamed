import { serialize, deserialize } from "./shared";

describe("shared", () => {
  describe("serialize()", () => {
    it("should prepend an S if the payload is a string", () => {
      expect(serialize("foo")).toEqual("Sfoo");
    });

    it("should prepend a J if the payload is JSON-stringified", () => {
      expect(serialize({})).toEqual("J{}");
      expect(serialize([])).toEqual("J[]");
      expect(serialize(null)).toEqual("Jnull");
      expect(serialize(undefined)).toEqual("");
      expect(serialize(0)).toEqual("J0");
    });

    it("should escape delimiter characters", () => {
      expect(serialize("§§§")).toEqual("S%§%§%§");
      expect(serialize("§\n§")).toEqual("S%§\n%§");
      expect(serialize({ foo: "b§a§r" })).toEqual(`J{"foo":"b%§a%§r"}`);
    });
  });

  describe("deserialize", () => {
    it("should treat S-prefixed payloads as string", () => {
      expect(deserialize("Sfoo")).toEqual("foo");
    });

    it("should parse J-prefixed payloads with JSON.parse", () => {
      expect(deserialize("J{}")).toEqual({});
      expect(deserialize("J[]")).toEqual([]);
      expect(deserialize("Jnull")).toEqual(null);
      expect(deserialize("")).toEqual(undefined);
      expect(deserialize("J0")).toEqual(0);
    });
  });
});
