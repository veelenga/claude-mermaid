# Claude Mermaid — Live Mermaid diagram previews for Claude Code

claude-mermaid is an MCP server that renders Mermaid diagrams in your browser and reloads them over a WebSocket every time Claude edits the code. Flowcharts, sequence diagrams, ER diagrams — previewed live, exported to SVG, PNG, or PDF.

Free and open source · MIT license · works with any MCP client.

- Website: https://veelenga.github.io/claude-mermaid/
- GitHub: https://github.com/veelenga/claude-mermaid
- npm: https://www.npmjs.com/package/claude-mermaid
- Structured index for agents: https://veelenga.github.io/claude-mermaid/llms.txt

## How it works

A local render loop with four moving parts:

1. **Claude calls a tool.** When you ask for a diagram, Claude calls `mermaid_preview` with the Mermaid code and a `preview_id` that names the session.
2. **It renders with mermaid-cli.** The server writes the code to a working file and runs `@mermaid-js/mermaid-cli` to produce an SVG in your chosen theme, background, and scale.
3. **It serves the diagram locally.** A small local server hosts the result at `http://localhost:3737/{preview_id}` and opens it in your browser the first time.
4. **It reloads live over WebSocket.** Every later edit re-renders the file and pushes a reload down a WebSocket. A green dot means the tab is connected; red means it is reconnecting.

## Features

- **Live reload** — the browser refreshes automatically as Claude edits the diagram, with a status dot showing the WebSocket connection.
- **SVG, PNG, and PDF export** — preview in SVG and save to any of three formats. PNG and PDF render on demand when you save them.
- **Four themes** — render in `default`, `forest`, `dark`, or `neutral`, with control over background, dimensions, and scale.
- **Pan, zoom, and export in-preview** — drag to pan, use browser zoom, recenter with one click, and download as SVG or PNG straight from the preview.
- **Multiple concurrent previews** — give each diagram its own `preview_id` and work on several diagrams side by side.
- **Persistent working files** — live previews are kept under `~/.config/claude-mermaid/live`, so diagrams survive between sessions.
- **Standalone gallery** — run `claude-mermaid --serve` to open a browser gallery of every diagram you have rendered, no agent required.
- **Built-in diagram skill** — the Claude Code plugin ships a skill with Mermaid best practices, so diagrams come out well-formed.

## Installation

### Claude Code plugin (recommended)

Add the marketplace and install the plugin from inside Claude Code, then restart to activate it:

```
/plugin marketplace add veelenga/claude-mermaid
/plugin install claude-mermaid@claude-mermaid
```

Restart Claude Code, then run `/mcp` — you should see `mermaid` in the server list.

### npm

Install the CLI globally and register it as a user-scoped MCP server:

```bash
npm install -g claude-mermaid
claude mcp add --scope user mermaid claude-mermaid
```

Verify with `claude mcp list` — you should see `mermaid: claude-mermaid - ✓ Connected`.

### Other MCP clients

For Cursor, Codex, Windsurf, Cline, Gemini CLI, or any other MCP client, install the package and add this to the client's MCP configuration:

```json
{
  "mcpServers": {
    "mermaid": {
      "command": "claude-mermaid"
    }
  }
}
```

Some clients want an absolute path — find it with `which claude-mermaid` and use that as the command.

## Tools reference

The server exposes exactly two tools.

### mermaid_preview — render and open a live preview

| Parameter    | Type   | Default   | Description                                                           |
| ------------ | ------ | --------- | --------------------------------------------------------------------- |
| `diagram`    | string | required  | The Mermaid diagram code to render.                                   |
| `preview_id` | string | required  | Names the preview session. Use different IDs for concurrent diagrams. |
| `format`     | string | `svg`     | One of `svg`, `png`, `pdf`. Live preview is SVG-only.                 |
| `theme`      | string | `default` | One of `default`, `forest`, `dark`, `neutral`.                        |
| `background` | string | `white`   | Background color, e.g. `transparent`, `white`, `#F0F0F0`.             |
| `width`      | number | `800`     | Diagram width in pixels.                                              |
| `height`     | number | `600`     | Diagram height in pixels.                                             |
| `scale`      | number | `2`       | Scale factor for higher-quality output.                               |

### mermaid_save — save the current diagram to a path

| Parameter    | Type   | Default  | Description                                                            |
| ------------ | ------ | -------- | ---------------------------------------------------------------------- |
| `save_path`  | string | required | Destination path, e.g. `./docs/diagram.svg`.                           |
| `preview_id` | string | required | Must match the `preview_id` used in `mermaid_preview`.                 |
| `format`     | string | `svg`    | One of `svg`, `png`, `pdf`. Rendered on demand if no working file yet. |

## FAQ

**Which clients are supported?** Built for Claude Code, where the plugin also installs a diagram skill. Because it speaks the Model Context Protocol, it works with any MCP client — Cursor, Codex, Windsurf, Cline, and Gemini CLI included.

**Does live reload work for PNG and PDF?** Live preview in the browser is SVG-only. PNG and PDF still render and can be saved or exported, but they do not auto-reload.

**Where are my diagrams stored?** Live working files are kept under `~/.config/claude-mermaid/live`, logs under `~/.config/claude-mermaid/logs`. The `mermaid_save` tool copies the rendered diagram to any path you choose.

**What ports does it use?** The local preview server uses ports 3737–3747 and automatically picks the first one that is free.

**Can I preview several diagrams at once?** Yes. Give each diagram its own `preview_id`, such as `architecture` or `flow`, and each gets its own live URL that reloads independently.

**Is it free?** Yes. claude-mermaid is open source under the MIT license.

---

MIT licensed · built by Vitalii Elenhaupt · [GitHub](https://github.com/veelenga/claude-mermaid) · [npm](https://www.npmjs.com/package/claude-mermaid) · [Mermaid docs](https://mermaid.js.org/) · [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code)
