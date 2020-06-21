# nano-net

A blazing fast, slim communication protocol for IPC.

## Goals

- [ ] Support Unix, Windows, TCP and TLS sockets
- [x] Completely typed TypeScript API for certain topics
- [x] Minimal protocol overhead
- [x] Requesting, messaging and publish / subscribe
- [x] No third party dependencies

## Example

`shared.ts`

```ts
enum AuthTopics {
  login,
}
interface AuthApi {
  [AuthTopics.login]: {
    req: Credentials;
    res: User;
  };
}
```

`server.ts`

```ts
import { AuthApi, AuthTopics } from "./shared";

const ns = new NanoServer<AuthApi>()
  .onRequest(AuthTopics.login, authenticate)
  .listen("/tmp/auth-test");
```

`client.ts`

```ts
import { AuthApi, AuthTopics } from "./shared";

const nc = new NanoClient<AuthApi>("/tmp/auth-test").connect();
nc.request(AuthTopics.login, new Credentials("user", "p4ssw0rd")).then((user) =>
  console.log(user)
);
```

## Protocol

Message types (Not completely implementing yet).

| Type           | Message-Pattern                  | Examples                            |
| -------------- | -------------------------------- | ----------------------------------- |
| Request        | `?<topic>\|<id>[\|payload]`      | `?1\|8\|J{"foo":"bar"}`<br>`?2\|45` |
| Response       | `.<id>[\|payload]`               | `.8\|J{"foo":"bar"}`<br>`.45`       |
| Error-Response | `X<id>\|<error-code>[\|message]` | `X8\|12\|Some msg`<br>`X45\|42`     |
| Subscribe      | `+<topic>`                       | `+1`                                |
| Unsubscribe    | `-<topic>`                       | `-1`                                |
| Message / Push | `!<topic>[\|payload]`            | `!1\|J{"foo":"bar"}`<br>`!2`        |

Where the tokens have the following format

| Token      | Format              | Note                                                                                     |
| ---------- | ------------------- | ---------------------------------------------------------------------------------------- |
| topic      | utf-8 (except `\|`) | You can use TS Enums                                                                     |
| id         | numeric             | Auto-generated                                                                           |
| error-code | utf-8 (except `\|`) | You can use TS Enums                                                                     |
| message    | utf-8               | Custom Error decription                                                                  |
| payload    | utf-8               | JSON or simple string. Json payload has a `J` prefix and other strings have a `S` prefix |
