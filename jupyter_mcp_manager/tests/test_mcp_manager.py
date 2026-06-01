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
        manager = McpServerManager(builtin_servers=[])
        settings = manager.get_settings()

        assert settings.mcp_servers == []

    def test_builtin_servers(self):
        """Test manager with built-in servers."""
        builtin = [
            {"name": "builtin-http", "type": "http", "url": "http://localhost:8080"},
            {"name": "builtin-stdio", "command": "/usr/bin/mcp-server"}
        ]
        manager = McpServerManager(builtin_servers=builtin)
        settings = manager.get_settings()

        assert len(settings.mcp_servers) == 2
        assert any(s.name == "builtin-http" for s in settings.mcp_servers)
        assert any(s.name == "builtin-stdio" for s in settings.mcp_servers)

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
                [],
                builtin_servers=[],
                extra_config_paths=[str(config_file)]
            )
            settings = manager.get_settings()

            assert len(settings.mcp_servers) == 1
            assert settings.mcp_servers[0].name == "test-http"
            assert settings.mcp_servers[0].url == "http://localhost:9090"

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
                builtin_servers=[],
                extra_config_paths=[str(Path(tmpdir) / "mcp_settings.json")]
            )
            settings = manager.get_settings()

            assert len(settings.mcp_servers) == 1
            assert settings.mcp_servers[0].name == "dir-server"

    def test_deduplication_by_name(self):
        """Test that servers with same name are deduplicated."""
        builtin = [
            {"name": "server1", "type": "http", "url": "http://builtin.com"}
        ]

        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "mcp_settings.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "server1", "type": "http", "url": "http://override.com"}
                ]
            }))

            manager = McpServerManager(
                [],
                builtin_servers=builtin,
                extra_config_paths=[str(config_file)]
            )
            settings = manager.get_settings()

            # User-defined server should override built-in
            assert len(settings.mcp_servers) == 1
            assert settings.mcp_servers[0].url == "http://override.com"

    def test_get_server_by_name(self):
        """Test getting a specific server by name."""
        manager = McpServerManager(
            [],
            builtin_servers=[
                {"name": "server-a", "type": "http", "url": "http://a.com"},
                {"name": "server-b", "type": "http", "url": "http://b.com"}
            ]
        )

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
                [],
                builtin_servers=[],
                extra_config_paths=[str(config_file)]
            )

            # Initial load
            settings1 = manager.get_settings()
            assert len(settings1.mcp_servers) == 1
            assert settings1.mcp_servers[0].name == "initial"

            # Modify config file
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "updated", "type": "http", "url": "http://updated.com"}
                ]
            }))

            # Reload
            manager.clear_cache()
            settings2 = manager.get_settings()
            assert len(settings2.mcp_servers) == 1
            assert settings2.mcp_servers[0].name == "updated"

    def test_add_config_dir(self):
        """Test adding a config directory dynamically."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = McpServerManager(builtin_servers=[])

            # Initially no servers
            settings1 = manager.get_settings()
            assert len(settings1.mcp_servers) == 0

            # Add config dir with a config file
            config_file = Path(tmpdir) / "mcp_settings.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "new-server", "type": "http", "url": "http://new.com"}
                ]
            }))

            manager.add_config_dir(tmpdir)
            settings2 = manager.get_settings()
            assert len(settings2.mcp_servers) == 1
            assert settings2.mcp_servers[0].name == "new-server"

    def test_add_config_path(self):
        """Test adding a config file path dynamically."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_file = Path(tmpdir) / "custom.json"
            config_file.write_text(json.dumps({
                "mcp_servers": [
                    {"name": "custom", "type": "http", "url": "http://custom.com"}
                ]
            }))

            manager = McpServerManager(builtin_servers=[])

            # Initially no servers
            settings1 = manager.get_settings()
            assert len(settings1.mcp_servers) == 0

            manager.add_config_path(str(config_file))
            settings2 = manager.get_settings()
            assert len(settings2.mcp_servers) == 1
            assert settings2.mcp_servers[0].name == "custom"

    def test_stdio_server_parsing(self):
        """Test parsing stdio server configuration."""
        manager = McpServerManager(
            [],
            builtin_servers=[
                {
                    "name": "stdio-server",
                    "command": "/usr/bin/mcp",
                    "args": ["--verbose"],
                    "env": [{"name": "DEBUG", "value": "1"}]
                }
            ]
        )
        settings = manager.get_settings()

        assert len(settings.mcp_servers) == 1
        server = settings.mcp_servers[0]
        assert isinstance(server, McpServerStdio)
        assert server.command == "/usr/bin/mcp"
        assert server.args == ["--verbose"]
        assert len(server.env) == 1
        assert server.env[0].name == "DEBUG"
        assert server.env[0].value == "1"

    def test_http_server_parsing(self):
        """Test parsing HTTP server configuration."""
        manager = McpServerManager(
            [],
            builtin_servers=[
                {
                    "name": "http-server",
                    "type": "http",
                    "url": "http://localhost:8080",
                    "headers": [{"name": "Authorization", "value": "Bearer token"}]
                }
            ]
        )
        settings = manager.get_settings()

        assert len(settings.mcp_servers) == 1
        server = settings.mcp_servers[0]
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
                [],
                builtin_servers=[],
                extra_config_paths=[str(config_file)]
            )
            settings = manager.get_settings()

            # Should return empty settings, not crash
            assert settings.mcp_servers == []


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
        manager = McpServerManager(builtin_servers=[])
        result = manager._get_lab_settings_path()
        assert result is not None
        assert result.endswith("plugin.jupyterlab-settings")

    def test_lab_settings_path_missing(self):
        """_get_lab_settings_path returns None when the file does not exist."""
        manager = McpServerManager(builtin_servers=[])
        assert manager._get_lab_settings_path() is None

    def test_load_lab_settings(self, isolate_lab_data_dir):
        """_load_lab_settings parses mcpSettings.mcp_servers correctly."""
        servers = [{"name": "lab-server", "type": "http", "url": "http://lab.example.com"}]
        self._make_lab_settings_file(isolate_lab_data_dir, servers)
        manager = McpServerManager(builtin_servers=[])
        assert manager._load_lab_settings() == {"mcp_servers": servers}

    def test_load_lab_settings_empty(self, isolate_lab_data_dir):
        """_load_lab_settings returns None when mcp_servers list is empty."""
        self._make_lab_settings_file(isolate_lab_data_dir, [])
        manager = McpServerManager(builtin_servers=[])
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
            builtin_servers=[],
            extra_config_paths=[str(config_file)],
        )
        settings = manager.get_settings()
        assert len(settings.mcp_servers) == 3
        server_a = next(s for s in settings.mcp_servers if s.name == "server-a")
        assert server_a.url == "http://new.example.com"


class TestMcpSettings:
    """Tests for McpSettings model."""

    def test_empty_settings(self):
        """Test empty settings."""
        settings = McpSettings()
        assert settings.mcp_servers == []

    def test_settings_with_servers(self):
        """Test settings with servers."""
        settings = McpSettings(mcp_servers=[
            McpServerHttp(name="http1", url="http://a.com"),
            McpServerStdio(name="stdio1", command="/usr/bin/mcp")
        ])
        assert len(settings.mcp_servers) == 2


class TestGetMcpManager:
    """Tests for get_mcp_manager function."""

    def test_creates_manager(self):
        """Test that get_mcp_manager creates a manager."""
        manager = get_mcp_manager()
        assert isinstance(manager, McpServerManager)

    def test_passes_parameters(self):
        """Test that parameters are passed to the manager."""
        builtin = [{"name": "test", "type": "http", "url": "http://test.com"}]
        manager = get_mcp_manager(builtin_servers=builtin)
        settings = manager.get_settings()

        assert len(settings.mcp_servers) == 1
        assert settings.mcp_servers[0].name == "test"
