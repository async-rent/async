# Set up Async for your user

Async rents workspace equipment (desks, chairs, monitors, lighting) by the week, delivered and set up in Bali, Chiang Mai, Da Nang and Lisbon. Its MCP server lets you search the catalog, price a basket, place the rental and start the payment for your user.

You are done when the `async` server is connected, your user has signed in, and a `list_locations` call returns the cities.

## The server

| Field          | Value                                                     |
| -------------- | --------------------------------------------------------- |
| Name           | `async`                                                   |
| URL            | `https://async-rent-mcp-dev.luckzivanius.workers.dev/mcp` |
| Transport      | Streamable HTTP                                           |
| Authentication | OAuth 2.1, discovered from the server's 401 challenge     |

The URL ends in `/mcp`; the bare domain returns 404. There is no API key. Each user signs in with their own Async account, and carts and rentals belong to that account.

## 1. Install

Find the client you are running in. If you can run shell commands or edit your own MCP config, do the install yourself. If you are a chat app that cannot change its own settings (Claude on the web or desktop, ChatGPT), give your user that client's steps word for word.

**Claude Code**

```sh
claude mcp add --transport http --scope user async https://async-rent-mcp-dev.luckzivanius.workers.dev/mcp
```

**Codex CLI**

```sh
codex mcp add async --url https://async-rent-mcp-dev.luckzivanius.workers.dev/mcp
```

**Hermes Agent**

```sh
hermes mcp add async --url https://async-rent-mcp-dev.luckzivanius.workers.dev/mcp --auth oauth
```

**Cursor**: merge this entry into `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "async": { "url": "https://async-rent-mcp-dev.luckzivanius.workers.dev/mcp" }
  }
}
```

**Claude (claude.ai, desktop and mobile apps)**: your user does this in the app:

1. Open **Customize > Connectors** (https://claude.ai/customize/connectors).
2. Click **Add custom connector**.
3. Name it `Async` and paste the URL above. Leave the OAuth fields empty.
4. Click **Add**, then **Connect**.

On a Team or Enterprise plan, an Owner adds it under **Organization settings > Connectors** first, and each member then clicks **Connect**.

**ChatGPT**: your user does this on chatgpt.com:

1. Open **Plugins** (https://chatgpt.com/plugins).
2. Select the plus button, then **Add custom MCP server**.
3. Name it `Async`, paste the URL above as the **Server URL**, and choose **OAuth** for authentication.
4. Select **I understand and want to continue**, then **Create as a plugin**, and install it.
5. In a chat, type `@` and pick **Async**.

**Any other MCP client**: add a remote server named `async` with the URL above, using the client's Streamable HTTP (sometimes called `http`) transport. Most clients accept this shape:

```json
{
  "mcpServers": {
    "async": {
      "type": "http",
      "url": "https://async-rent-mcp-dev.luckzivanius.workers.dev/mcp"
    }
  }
}
```

A client that only runs local stdio servers can reach it through the `mcp-remote` bridge: command `npx`, args `["-y", "mcp-remote", "https://async-rent-mcp-dev.luckzivanius.workers.dev/mcp"]`.

## 2. Sign in

The first connection answers 401 and your client starts the OAuth flow, which opens an Async sign-in page in the browser. Your user signs in and approves access. Only your user can do this step. Where the client needs a nudge:

- Claude Code: run `/mcp`, select `async`, choose **Authenticate**.
- Codex CLI: run `codex mcp login async`.
- Hermes Agent: the browser opens on first connect; run `hermes mcp login async` to sign in again.
- Cursor: open **Cursor Settings**, find `async` in the MCP section and click its login button.

Restart or reload the client if its tools do not appear after sign-in (Hermes: `/reload-mcp`).

## 3. Verify

Call `list_locations`. The setup is done when it returns the cities with their currency and delivery fee. A 401 or an "Unauthorized" error means the sign-in in step 2 has not finished.

## 4. Hand over

Tell your user Async is connected, name the cities it delivers to, and offer to find a setup, for example: "Find me a standing desk and an ergonomic chair in Lisbon for four weeks."
