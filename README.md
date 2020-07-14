# beamed

[![Build Status](https://travis-ci.com/svi3c/node-beamed.svg?branch=master)](https://travis-ci.com/github/svi3c/node-beamed)

> A blazing fast, slim communication protocol for NodeJS IPC.

[![NPM](https://nodei.co/npm/beamed.png)](https://www.npmjs.com/package/beamed)

## Features

- A lightweight protocol minimizes network traffic and provides high processing performance
- The TypeScript API enables you to specify strictly typed endpoints and reuse the same type definitions on client and server side
- Support for Unix, Windows, TCP and TLS sockets
- Requesting, messaging and publish / subscribe
- Send any payload (objects, buffers and strings)
- No third party dependencies

## Example

`shared.ts`

```ts
enum AuthTopics {
  login, // can be strings or numbers
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
import { createServer } from "beamed";
import { AuthApi, AuthTopics } from "./shared";

const bs = createServer<AuthApi>()
  .onRequest(AuthTopics.login, authenticate)
  .listen("/tmp/auth-test");
```

`client.ts`

```ts
import { connect } from "beamed";
import { AuthApi, AuthTopics } from "./shared";

const bc = connect<AuthApi>("/tmp/auth-test");
bc.request(AuthTopics.login, new Credentials("user", "p4ssw0rd")).then((user) =>
  console.log(user)
);
```

## Protocol

Message types (Not completely implementing yet).

| Type           | Message-Pattern                          | Examples                               |
| -------------- | ---------------------------------------- | -------------------------------------- |
| Request        | `<length>?<topic>\|<id>[\|payload]`      | `19?1\|8\|J{"foo":"bar"}`<br>`5?2\|45` |
| Response       | `<length>.<id>[\|payload]`               | `17.8\|J{"foo":"bar"}`<br>`3.45`       |
| Error-Response | `<length>X<id>\|<error-code>[\|message]` | `17.8\|J{"foo":"bar"}`<br>`6X45\|42`   |
| Subscribe      | `<length>+<topic>`                       | `2+1`                                  |
| Unsubscribe    | `<length>-<topic>`                       | `2-1`                                  |
| Message / Push | `<length>!<topic>[\|payload]`            | `17!1\|J{"foo":"bar"}`<br>`2!2`        |

Where the tokens have the following format

| Token      | Format              | Note                                                                                                               |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| length     | numeric             | The byte length of the message content without this length (auto-generated)                                        |
| topic      | utf-8 (except `\|`) | You can use TS Enums                                                                                               |
| id         | numeric             | The request id (auto-generated)                                                                                    |
| error-code | utf-8 (except `\|`) | You can use TS Enums                                                                                               |
| message    | utf-8               | Custom Error decription                                                                                            |
| payload    | utf-8 or Buffer     | Prefixed by a character that determines the content type:<br>`J` for Json,<br>`B` for binary data,<br>`T` for text |
