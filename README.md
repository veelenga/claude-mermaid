# Claude Mermaid MCP Server

MCP server for rendering Mermaid diagrams in Claude Code.

![Demo](https://raw.githubusercontent.com/veelenga/claude-mermaid/main/assets/demo.gif)

## Examples

<details>
<summary>Package Dependencies</summary>

![Dependencies Diagram](https://raw.githubusercontent.com/veelenga/claude-mermaid/main/assets/example-dependencies.png)
</details>

<details>
<summary>Project Architecture</summary>

![Architecture Diagram](https://raw.githubusercontent.com/veelenga/claude-mermaid/main/assets/example-architecture.png)
</details>

<details>
<summary>HTTPS Connection Flow</summary>

![HTTPS Sequence Diagram](https://raw.githubusercontent.com/veelenga/claude-mermaid/main/assets/example-https.png)
</details>

## Installation

### From npm

```bash
npm install -g claude-mermaid
```

### From Source

```bash
git clone https://github.com/veelenga/claude-mermaid.git && cd claude-mermaid
npm install
npm run build
npm install -g .
```

## Configuration

Add the MCP server to Claude Code locally (current directory):

```bash
claude mcp add mermaid claude-mermaid
```

Or add it globally (available in all directories):

```bash
claude mcp add --scope user mermaid claude-mermaid
```

Or manually add to your MCP config file:

```json
{
  "mcpServers": {
    "mermaid": {
      "command": "claude-mermaid"
    }
  }
}
```

## Usage

Once configured, you can ask Claude Code to create and render Mermaid diagrams:

```
"Create a Mermaid diagram showing the user authentication flow"
```

Claude will automatically use the `render_mermaid` tool to render the diagram and open it in your default viewer.

### Tool Parameters

- `diagram` (required): The Mermaid diagram code
- `format` (optional): Output format - `png`, `svg`, or `pdf` (default: `svg`)
- `browser` (optional): Wrap diagram in HTML page for browser viewing (default: `false`)
- `theme` (optional): Chart theme - `default`, `forest`, `dark`, or `neutral` (default: `default`)
- `background` (optional): Background color for pngs/svgs - e.g., `transparent`, `white`, `#F0F0F0` (default: `white`)
- `width` (optional): Diagram width in pixels (default: `800`)
- `height` (optional): Diagram height in pixels (default: `600`)
- `scale` (optional): Scale factor for higher quality output (default: `2`)
- `save_path` (optional): Path to save the diagram file - e.g., `./docs/diagram.svg`

### Examples

You can request different output formats and styles:

```
"Create user auth diagram in SVG"
"Render pizza delivery diagram as a PDF"
"Show me diagram explaining how https works in browser" (uses browser mode)
"Create a dark theme flowchart with transparent background"
"Save the architecture diagram to ./docs/architecture.svg"
```

### Example

```
"Create a flowchart diagram and save to ./docs/auth-flow.svg:
graph LR
    A[User Login] --> B{Valid Credentials?}
    B -->|Yes| C[Access Granted]
    B -->|No| D[Access Denied]
    C --> E[Dashboard]
    D --> F[Try Again]

    style A fill:#e1f5ff
    style C fill:#d4edda
    style D fill:#f8d7da
"
```

The diagram will be automatically rendered, saved to your project, and opened in your default viewer.

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Start server
npm start
```

## License

MIT
