export type MessageHandler<K extends keyof T, T> = (
  payload: MessageBody<K, T>
) => void;
export type PushHandler<K extends keyof T, T> = (
  payload: PushBody<K, T>
) => void;
export type RequestHandler<K extends keyof T, T> = (
  payload: RequestBody<K, T>
) => Promise<ResponseBody<K, T>> | ResponseBody<K, T>;
interface ApiPayloads {
  msg?: any;
  push?: any;
  req?: any;
  res?: any;
}
type Body<K extends keyof T, X extends keyof ApiPayloads, T> = T[K] extends {
  [key in X]: infer P;
}
  ? P
  : void;
export type MessageBody<K extends keyof T, T> = Body<K, "msg", T>;
export type PushBody<K extends keyof T, T> = Body<K, "push", T>;
export type RequestBody<K extends keyof T, T> = Body<K, "req", T>;
export type ResponseBody<K extends keyof T, T> = Body<K, "res", T>;
export type RequestParams<K extends keyof T, T> = T[K] extends {
  req?: infer Req;
}
  ? Req extends void
    ? []
    : [Req]
  : [];
