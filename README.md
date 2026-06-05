# jupyter_mcp_manager

[![Github Actions Status](https://github.com/brichet/jupyter-mcp-manager/workflows/Build/badge.svg)](https://github.com/brichet/jupyter-mcp-manager/actions/workflows/build.yml)

**A JupyterLab extension for managing Model Context Protocol (MCP) servers.**

This extension provides a user interface and backend infrastructure to configure and manage MCP servers directly within JupyterLab. It allows you to define which MCP servers are available for use by other JupyterLab extensions or AI assistants.

## What is MCP?

The **Model Context Protocol (MCP)** is an open standard that enables AI assistants and other clients to interact with various data sources, tools, and services through a unified interface. MCP servers expose resources, tools, and prompts that AI models can query and use during conversations.

This extension manages the MCP server configurations that other JupyterLab extensions (like `jupyter_server_mcp`) or external clients can use to connect to and interact with MCP servers.

## Features

- **Configuration Management**: Add, edit, and remove MCP server configurations through a dedicated settings panel in JupyterLab
- **Multiple Server Types**: Support for both **stdio** (local executable) and **HTTP** (remote endpoint) MCP servers
- **Flexible Configuration**: Configure servers via:
  - JupyterLab Settings UI (persisted in browser)
  - JSON configuration files in Jupyter config directories (`~/.jupyter/mcp_servers.json`)
- **Environment Variables & Headers**: Set custom environment variables for stdio servers and HTTP headers for HTTP servers
- **Real-time Updates**: Automatic synchronization between frontend settings and backend configuration

## Requirements

- JupyterLab >= 4.0.0
- Python >= 3.10

## Install

To install the extension, execute:

```bash
pip install jupyter_mcp_manager
```

After installation, restart JupyterLab for the extension to be activated.

## Usage

### Accessing MCP Server Settings

1. Open JupyterLab
2. Go to **Settings** > **Advanced Settings Editor**
3. Select **MCP Manager** from the left sidebar
4. Configure your MCP servers using the UI or switch to the **JSON** tab for raw JSON editing

### Configuration File

You can also configure MCP servers by creating a `mcp_servers.json` file in your Jupyter config directory (typically `~/.jupyter/`):

```json
{
  "mcp_servers": [
    {
      "name": "my-stdio-server",
      "type": "stdio",
      "command": "/path/to/mcp-server-executable",
      "args": ["--option1", "value1"],
      "env": [{ "name": "ENV_VAR", "value": "value" }]
    },
    {
      "name": "my-http-server",
      "type": "http",
      "url": "http://localhost:8080",
      "headers": [{ "name": "Authorization", "value": "Bearer token" }]
    }
  ]
}
```

### Server Configuration Options

#### Stdio Server (Local Executable)

| Field     | Required | Description                                                   |
| --------- | -------- | ------------------------------------------------------------- |
| `name`    | Yes      | Unique identifier for the server                              |
| `type`    | Yes      | Must be `"stdio"`                                             |
| `command` | Yes      | Path to the MCP server executable                             |
| `args`    | No       | Array of command-line arguments                               |
| `env`     | No       | Array of environment variables (each with `name` and `value`) |

#### HTTP Server (Remote Endpoint)

| Field     | Required | Description                                          |
| --------- | -------- | ---------------------------------------------------- |
| `name`    | Yes      | Unique identifier for the server                     |
| `type`    | Yes      | Must be `"http"`                                     |
| `url`     | Yes      | URL of the MCP server endpoint                       |
| `headers` | No       | Array of HTTP headers (each with `name` and `value`) |

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyter_mcp_manager
```

## Troubleshoot

If you are seeing the frontend extension, but it is not working, check
that the server extension is enabled:

```bash
jupyter server extension list
```

If the server extension is installed and enabled, but you are not seeing
the frontend extension, check the frontend extension is installed:

```bash
jupyter labextension list
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyter_mcp_manager directory

# Set up a virtual environment and install package in development mode
python -m venv .venv
source .venv/bin/activate
pip install --editable ".[dev,test]"

# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Server extension must be manually installed in develop mode
jupyter server extension enable jupyter_mcp_manager

# Rebuild extension Typescript source after making changes
# IMPORTANT: Unlike the steps above which are performed only once, do this step
# every time you make a change.
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
# Server extension must be manually disabled in develop mode
jupyter server extension disable jupyter_mcp_manager
pip uninstall jupyter_mcp_manager
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `jupyter-mcp-manager` within that folder.

### Testing the extension

#### Server tests

This extension is using [Pytest](https://docs.pytest.org/) for Python code testing.

Install test dependencies (needed only once):

```sh
pip install -e ".[test]"
# Each time you install the Python package, you need to restore the front-end extension link
jupyter labextension develop . --overwrite
```

To execute them, run:

```sh
pytest -vv -r ap --cov jupyter_mcp_manager
```

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro) for the integration tests (aka user level tests).
More precisely, the JupyterLab helper [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata) is used to handle testing the extension in JupyterLab.

More information are provided within the [ui-tests](./ui-tests/README.md) README.

### Packaging the extension

See [RELEASE](RELEASE.md)
