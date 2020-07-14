const CODE_T = "T".charCodeAt(0);
const CODE_J = "J".charCodeAt(0);

export const serialize = (payload: any) =>
  typeof payload === "string"
    ? Buffer.from(`T${payload}`)
    : Buffer.isBuffer(payload)
    ? Buffer.concat([Buffer.from("B"), payload])
    : Buffer.from(`J${JSON.stringify(payload)}`);

export const deserialize = (serialized: Buffer) => {
  const prefix = serialized[0];
  const content = serialized.slice(1);
  return prefix === CODE_J
    ? JSON.parse(content.toString("utf8"))
    : prefix === CODE_T
    ? content.toString("utf8")
    : content;
};

export const splitBuffer = (buffer: Buffer, needle: string, offset = 0) => {
  const idx = buffer.indexOf(needle, offset);
  return idx >= 0 ? [buffer.slice(0, idx), buffer.slice(idx + 1)] : [buffer];
};
