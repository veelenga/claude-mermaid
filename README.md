# Claude Mermaid MCP Server

MCP server for rendering Mermaid diagrams in Claude Code with **live reload** functionality.

Automatically renders diagrams in your browser with real-time updates as you refine them. Perfect for iterative diagram development and documentation workflows.

![Demo](https://raw.githubusercontent.com/veelenga/claude-mermaid/main/assets/demo.gif)

## ✨ Features

- 🔄 **Live Reload** - Diagrams auto-refresh in your browser as you edit
- 🎨 **Multiple Formats** - Export to SVG, PNG, or PDF
- 🌈 **Themes** - Choose from default, forest, dark, or neutral themes
- 📐 **Customizable** - Control dimensions, scale, and background colors
- 💾 **Auto-Save** - Saves to `~/.config/claude-mermaid/` or your project directory

## Architecture

<details>
<summary>Project Architecture Diagram</summary>

![Architecture Diagram](https://raw.githubusercontent.com/veelenga/claude-mermaid/main/assets/architecture.png)
</details>

<details>
<summary>User Workflow Diagram</summary>

![User Workflow Diagram](https://raw.githubusercontent.com/veelenga/claude-mermaid/main/assets/workflow.png)
</details>

<details>
<summary>Dependencies Diagram</summary>

![Dependencies Diagram](https://raw.githubusercontent.com/veelenga/claude-mermaid/main/assets/dependencies.png)
</details>

## 🚀 Quick Start

### 1. Install

**From npm:**
```bash
npm install -g claude-mermaid
```

**From source:**
```bash
git clone https://github.com/veelenga/claude-mermaid.git
cd claude-mermaid
npm install && npm run build && npm install -g .
```

### 2. Configure Claude Code

**Global setup** (recommended - works in all projects):
```bash
claude mcp add --scope user mermaid claude-mermaid
```

**Project-specific setup:**
```bash
claude mcp add mermaid claude-mermaid
```

**Manual configuration:**

Add to your MCP config file (`.claude.json` or `.mcp.json`):
```json
{
  "mcpServers": {
    "mermaid": {
      "command": "claude-mermaid"
    }
  }
}
```

### 3. Verify Installation

```bash
claude mcp list
```

You should see `mermaid: claude-mermaid - ✓ Connected`

## 💡 Usage

Simply ask Claude Code to create Mermaid diagrams. The server will:
1. ✅ Render the diagram
2. 🌐 Open it in your browser with live reload
3. 💾 Save it to disk (default: `~/.config/claude-mermaid/`)
4. 🔄 Auto-refresh when you make changes

### Basic Examples

```
"Create a Mermaid diagram showing the user authentication flow"
"Draw a sequence diagram for the payment process"
"Generate a flowchart for the deployment pipeline"
```

### Advanced Examples

**With custom formatting:**
```
"Create a dark theme architecture diagram with transparent background"
"Generate a forest theme flowchart and save to ./docs/flow.svg"
```

**With specific output format:**
```
"Create an ER diagram and save as PDF to ./docs/schema.pdf"
```
*Note: PDF format saves the PDF file while showing an SVG preview in the browser.*

**Iterative refinement:**
```
"Create a class diagram for the User module"
// Browser opens with live preview
"Add the Address and Order classes with relationships"
// Diagram updates automatically in browser!
```

### Complete Example

```
"Create a flowchart and save to ./docs/auth-flow.svg:

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

The diagram will be saved to `./docs/auth-flow.svg` and opened in your browser with live reload enabled.

## 🔧 Parameters

The `render_mermaid` tool accepts these parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `diagram` | string | *required* | The Mermaid diagram code |
| `format` | string | `svg` | Output format: `svg`, `png`, or `pdf` |
| `theme` | string | `default` | Theme: `default`, `forest`, `dark`, `neutral` |
| `background` | string | `white` | Background color (e.g., `transparent`, `white`, `#F0F0F0`) |
| `width` | number | `800` | Diagram width in pixels |
| `height` | number | `600` | Diagram height in pixels |
| `scale` | number | `2` | Scale factor for higher quality |
| `save_path` | string | `~/.config/claude-mermaid/live-diagram.{format}` | Where to save the file |

## 🎯 How Live Reload Works

1. **First render:** Opens diagram in browser at `http://localhost:3737/{id}`
2. **Make changes:** Edit the diagram through Claude Code
3. **Auto-refresh:** Browser detects changes via WebSocket and reloads
4. **Status indicator:** Green dot = connected, Red dot = reconnecting

The live server uses ports 3737-3747 and automatically finds an available port.

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev

# Start the MCP server directly
npm start
```

## 📝 Troubleshooting

**Server not connecting:**
```bash
# Check if server is installed
claude-mermaid -v

# Reinstall if needed
npm install -g claude-mermaid

# Verify MCP configuration
claude mcp list
```

**Permission denied error:**
```bash
# Make sure the binary is executable
chmod +x $(which claude-mermaid)
```

**Port already in use:**
- The server uses ports 3737-3747
- It will automatically find an available port
- Check if another process is using these ports: `lsof -i :3737-3747`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT - see [LICENSE](LICENSE) file for details

## 🔗 Links

- [GitHub Repository](https://github.com/veelenga/claude-mermaid)
- [npm Package](https://www.npmjs.com/package/claude-mermaid)
- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [Mermaid Documentation](https://mermaid.js.org/)
