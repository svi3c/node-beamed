const DELIMITER_CHAR = "§";
const ESCAPED = `%${DELIMITER_CHAR}`;
export const DELIMITER = DELIMITER_CHAR.repeat(2);
const DELIMITER_CHAR_REGEX = new RegExp(DELIMITER_CHAR, "g");
const ESCAPED_REGEX = new RegExp(ESCAPED, "g");

export const serialize = (payload: any) =>
  (typeof payload === "string"
    ? `S${payload}`
    : payload === undefined
    ? ""
    : `J${JSON.stringify(payload)}`
  ).replace(DELIMITER_CHAR_REGEX, ESCAPED);
export const deserialize = (serialized: string) =>
  serialized.length === 0
    ? undefined
    : serialized.replace(ESCAPED_REGEX, DELIMITER_CHAR).startsWith("J")
    ? JSON.parse(serialized.substr(1))
    : serialized.substr(1);
