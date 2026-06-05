"""Tests for the MCP server manager."""

import json
import tempfile
from pathlib import Path

from jupyter_mcp_manager.mcp_manager import (
    McpServerManager,
    get_mcp_manager,
)
from jupyter_mcp_manager.models import (
    McpSettings,
    McpServerStdio,
    McpServerHttp,
)


class TestMcpServerManager:
    """Tests for McpServerManager class."""

    def test_empty_config(self):
        """Test manager with no configuration files."""
        manager = McpServerManager()
        assert manager.get_servers() == []

    def test_config_file_loading(self):
        """Test loading configuration from a file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "mcp_settings.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "test-http", "type": "http", "url": "http://localhost:9090"}
                ]
            }))

            manager = McpServerManager(
                extra_config_paths=[str(config_file)]
            )
            servers = manager.get_servers()

            assert len(servers) == 1
            assert servers[0].name == "test-http"
            assert servers[0].url == "http://localhost:9090"

    def test_config_file_in_dir(self):
        """Test loading configuration from a config directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "mcp_settings.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "dir-server", "type": "http", "url": "http://example.com"}
                ]
            }))

            manager = McpServerManager(
                extra_config_paths=[str(config_file)]
            )
            servers = manager.get_servers()

            assert len(servers) == 1
            assert servers[0].name == "dir-server"

    def test_deduplication_by_name(self):
        """Test that servers with same name are deduplicated, later file wins."""
        with tempfile.TemporaryDirectory() as tmpdir:
            first = Path(tmpdir) / "first.json"
            first.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "server1", "type": "http", "url": "http://first.com"}
                ]
            }))
            second = Path(tmpdir) / "second.json"
            second.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "server1", "type": "http", "url": "http://override.com"}
                ]
            }))

            manager = McpServerManager(
                extra_config_paths=[str(first), str(second)]
            )
            servers = manager.get_servers()

            assert len(servers) == 1
            assert servers[0].url == "http://override.com"

    def test_get_server_by_name(self):
        """Test getting a specific server by name."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "mcp_servers.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "server-a", "type": "http", "url": "http://a.com"},
                    {"name": "server-b", "type": "http", "url": "http://b.com"},
                ]
            }))
            manager = McpServerManager(extra_config_paths=[str(config_file)])

            server = manager.get_server_by_name("server-a")
            assert server is not None
            assert server.url == "http://a.com"

            server = manager.get_server_by_name("nonexistent")
            assert server is None

    def test_reload(self):
        """Test reloading configuration."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "mcp_settings.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "initial", "type": "http", "url": "http://initial.com"}
                ]
            }))

            manager = McpServerManager(
                extra_config_paths=[str(config_file)]
            )

            servers1 = manager.get_servers()
            assert len(servers1) == 1
            assert servers1[0].name == "initial"

            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "updated", "type": "http", "url": "http://updated.com"}
                ]
            }))

            manager.clear_cache()
            servers2 = manager.get_servers()
            assert len(servers2) == 1
            assert servers2[0].name == "updated"

    def test_add_config_dir(self):
        """Test adding a config directory dynamically."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = McpServerManager()

            assert len(manager.get_servers()) == 0

            config_file = Path(tmpdir) / "mcp_settings.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "new-server", "type": "http", "url": "http://new.com"}
                ]
            }))

            manager.add_config_dir(tmpdir)
            servers = manager.get_servers()
            assert len(servers) == 1
            assert servers[0].name == "new-server"

    def test_add_config_path(self):
        """Test adding a config file path dynamically."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "custom.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "custom", "type": "http", "url": "http://custom.com"}
                ]
            }))

            manager = McpServerManager()

            assert len(manager.get_servers()) == 0

            manager.add_config_path(str(config_file))
            servers = manager.get_servers()
            assert len(servers) == 1
            assert servers[0].name == "custom"

    def test_add_server(self):
        """Test adding a server dict directly."""
        manager = McpServerManager()

        assert len(manager.get_servers()) == 0

        manager.add_server({"name": "dynamic", "type": "http", "url": "http://dynamic.com"})
        servers = manager.get_servers()
        assert len(servers) == 1
        assert servers[0].name == "dynamic"

    def test_add_server_lower_priority_than_config_file(self):
        """Test that a config file overrides a server added via add_server."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "mcp_servers.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "server1", "type": "http", "url": "http://override.com"}
                ]
            }))
            manager = McpServerManager(extra_config_paths=[str(config_file)])
            manager.add_server({"name": "server1", "type": "http", "url": "http://default.com"})

            servers = manager.get_servers()
            assert len(servers) == 1
            assert servers[0].url == "http://override.com"

    def test_stdio_server_parsing(self):
        """Test parsing stdio server configuration."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "mcp_servers.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {
                        "type": "stdio",
                        "name": "stdio-server",
                        "command": "/usr/bin/mcp",
                        "args": ["--verbose"],
                        "env": [{"name": "DEBUG", "value": "1"}]
                    }
                ]
            }))
            manager = McpServerManager(extra_config_paths=[str(config_file)])
            servers = manager.get_servers()

        assert len(servers) == 1
        server = servers[0]
        assert isinstance(server, McpServerStdio)
        assert server.command == "/usr/bin/mcp"
        assert server.args == ["--verbose"]
        assert len(server.env) == 1
        assert server.env[0].name == "DEBUG"
        assert server.env[0].value == "1"

    def test_http_server_parsing(self):
        """Test parsing HTTP server configuration."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "mcp_servers.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {
                        "name": "http-server",
                        "type": "http",
                        "url": "http://localhost:8080",
                        "headers": [{"name": "Authorization", "value": "Bearer token"}]
                    }
                ]
            }))
            manager = McpServerManager(extra_config_paths=[str(config_file)])
            servers = manager.get_servers()

        assert len(servers) == 1
        server = servers[0]
        assert isinstance(server, McpServerHttp)
        assert server.url == "http://localhost:8080"
        assert len(server.headers) == 1
        assert server.headers[0].name == "Authorization"

    def test_invalid_config_file(self):
        """Test handling of invalid config file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "invalid.json"
            config_file.write_text("not valid json")

            manager = McpServerManager(
                extra_config_paths=[str(config_file)]
            )
            assert manager.get_servers() == []


class TestLabSettings:
    """Tests for JupyterLab settings file loading.

    The autouse fixture in conftest.py redirects jupyter_data_dir to tmp_path,
    so tests create files there and the manager picks them up automatically.
    """

    def _make_lab_settings_file(self, data_dir: Path, servers: list) -> Path:
        plugin_dir = data_dir / "lab" / "user-settings" / "jupyter-mcp-manager"
        plugin_dir.mkdir(parents=True)
        plugin_file = plugin_dir / "plugin.jupyterlab-settings"
        plugin_file.write_text(json.dumps({"mcpSettings": {"mcp_servers": servers}}))
        return plugin_file

    def test_lab_settings_path_exists(self, isolate_lab_data_dir):
        """_get_lab_settings_path returns the path when the file exists."""
        self._make_lab_settings_file(isolate_lab_data_dir, [])
        manager = McpServerManager()
        result = manager._get_lab_settings_path()
        assert result is not None
        assert result.endswith("plugin.jupyterlab-settings")

    def test_lab_settings_path_missing(self):
        """_get_lab_settings_path returns None when the file does not exist."""
        manager = McpServerManager()
        assert manager._get_lab_settings_path() is None

    def test_load_lab_settings(self, isolate_lab_data_dir):
        """_load_lab_settings parses mcpSettings.mcp_servers correctly."""
        servers = [{"name": "lab-server", "type": "http", "url": "http://lab.example.com"}]
        self._make_lab_settings_file(isolate_lab_data_dir, servers)
        manager = McpServerManager()
        assert manager._load_lab_settings() == {"mcp_servers": servers}

    def test_load_lab_settings_empty(self, isolate_lab_data_dir):
        """_load_lab_settings returns None when mcp_servers list is empty."""
        self._make_lab_settings_file(isolate_lab_data_dir, [])
        manager = McpServerManager()
        assert manager._load_lab_settings() is None

    def test_lab_settings_merged_with_priority(self, tmp_path, isolate_lab_data_dir):
        """Lab settings override same-named servers from traditional config files."""
        config_file = tmp_path / "mcp_servers.json"
        config_file.write_text(json.dumps({
            "mcp_servers": [
                {"name": "server-a", "type": "http", "url": "http://old.example.com"},
                {"name": "server-b", "type": "http", "url": "http://b.example.com"},
            ]
        }))
        self._make_lab_settings_file(isolate_lab_data_dir, [
            {"name": "server-a", "type": "http", "url": "http://new.example.com"},
            {"name": "server-c", "type": "http", "url": "http://c.example.com"},
        ])
        manager = McpServerManager(
            extra_config_paths=[str(config_file)],
        )
        servers = manager.get_servers()
        assert len(servers) == 3
        server_a = next(s for s in servers if s.name == "server-a")
        assert server_a.url == "http://new.example.com"


class TestMcpSettings:
    """Tests for McpSettings model."""

    def test_empty_settings(self):
        settings = McpSettings()
        assert settings.mcp_servers == []

    def test_settings_with_servers(self):
        settings = McpSettings(mcp_servers=[
            McpServerHttp(type="http", name="http1", url="http://a.com"),
            McpServerStdio(type="stdio", name="stdio1", command="/usr/bin/mcp")
        ])
        assert len(settings.mcp_servers) == 2


class TestGetMcpManager:
    """Tests for get_mcp_manager function."""

    def test_creates_manager(self):
        """Test that get_mcp_manager creates a manager."""
        manager = get_mcp_manager()
        assert isinstance(manager, McpServerManager)

    def test_passes_parameters(self):
        """Test that extra_config_paths are passed to the manager."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "mcp_servers.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [{"name": "test", "type": "http", "url": "http://test.com"}]
            }))
            manager = get_mcp_manager(extra_config_paths=[str(config_file)])
            servers = manager.get_servers()

        assert len(servers) == 1
        assert servers[0].name == "test"
