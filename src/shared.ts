export const serializePayload = (payload: any) =>
  typeof payload === "string" ? `S${payload}` : `J${JSON.stringify(payload)}`;
export const deserializePayload = (serialized: string) =>
  serialized.startsWith("J")
    ? JSON.parse(serialized.substr(1))
    : serialized.substr(1);
