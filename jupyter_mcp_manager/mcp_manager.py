# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import asyncio
import json
import os
from typing import Awaitable, Callable, List, Optional, Union

from jupyter_core.paths import jupyter_config_path, jupyter_config_dir
from jupyterlab_server.settings_utils import get_settings


from .models import (
    McpSettings,
    McpServerStdio,
    McpServerHttp,
)


class McpServerManager:
    """
    Manager for MCP servers that loads configuration from Jupyter config directories.

    This manager reads MCP server configurations from:
    1. Jupyter config directories (jupyter_config_path() - includes system and user dirs)
    2. User-specified config paths

    Configuration files are merged with the following precedence (later overrides earlier):
    - System jupyter config directories (/etc/jupyter, /usr/local/etc/jupyter, etc.)
    - User jupyter config directory (~/.jupyter)
    - User-specified paths (highest priority)
    """

    def __init__(
        self,
        log=None,
        extra_config_paths: Optional[List[str]] = None,
        lab_server_app=None
    ):
        """
        Initialize the MCP server manager.

        Args:
            log: Logger instance for logging messages
            extra_config_paths: Additional paths to config files to load
            lab_server_app: The JupyterLab server application, used to get the settings directory
        """
        self.log = log
        self.extra_config_paths = extra_config_paths or []
        self.lab_server_app = lab_server_app

        # Use Jupyter's config directories
        self.config_dirs = jupyter_config_path()

        self._extra_servers: List[dict] = []
        self._config_file_cache: Optional[McpSettings] = None
        self._all_servers_cache: Optional[McpSettings] = None

        # Observers notified when lab settings change
        self._observers: List[Callable[[], Union[None, Awaitable[None]]]] = []

    def _get_config_file_paths(self) -> List[str]:
        """Get all possible config file paths to check."""
        paths = []

        # Add files from config directories
        for config_dir in self.config_dirs:
            if config_dir:
                mcp_config = os.path.join(config_dir, "mcp_settings.json")
                if os.path.exists(mcp_config):
                    paths.append(mcp_config)

                # Also check for mcp_servers.json (alternative naming)
                mcp_servers = os.path.join(config_dir, "mcp_servers.json")
                if os.path.exists(mcp_servers):
                    paths.append(mcp_servers)

        # Add extra config paths
        for path in self.extra_config_paths:
            if os.path.exists(path):
                paths.append(path)

        return paths

    def _load_config_from_file(self, file_path: str) -> Optional[dict]:
        """Load configuration from a single JSON file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError, OSError) as e:
            if self.log:
                self.log.error(f"Failed to load MCP config from {file_path}: {e}")
            return None

    def _merge_configs(self, configs: List[dict]) -> dict:
        """
        Merge multiple configuration dictionaries.

        Later configs override earlier ones. Servers are deduplicated by name,
        with later entries taking precedence over earlier ones.
        """
        # Use a dict to track servers by name, preserving order
        servers_by_name = {}

        for config in configs:
            servers = config.get("mcp_servers", [])
            for server in servers:
                server_name = server.get("name")
                if server_name:
                    # Later configs override earlier ones
                    servers_by_name[server_name] = server

        return {"mcp_servers": list(servers_by_name.values())}

    def _get_lab_settings_path(self) -> Optional[str]:
        """Return the JupyterLab user settings file path if it exists, else None."""
        if self.lab_server_app and hasattr(self.lab_server_app, 'user_settings_dir'):
            settings_dir = self.lab_server_app.user_settings_dir
        else:
            settings_dir = os.path.join(jupyter_config_dir(), "lab", "user-settings")
        path = os.path.join(settings_dir, "jupyter-mcp-manager", "plugin.jupyterlab-settings")
        return path if os.path.isfile(path) else None

    def _load_lab_settings(self) -> Optional[dict]:
        """Load MCP servers from JupyterLab settings."""
        if self.lab_server_app:
            app_settings_dir = getattr(self.lab_server_app, 'app_settings_dir', None)
            schemas_dir = getattr(self.lab_server_app, 'schemas_dir', None)
            user_settings_dir = getattr(self.lab_server_app, 'user_settings_dir', None)
            labextensions_path = getattr(self.lab_server_app, 'labextensions_path', None)

            if all([app_settings_dir, schemas_dir, user_settings_dir, labextensions_path]):
                try:
                    settings, _ = get_settings(
                        app_settings_dir=app_settings_dir,
                        schemas_dir=schemas_dir,
                        settings_dir=user_settings_dir,
                        schema_name="jupyter-mcp-manager:manager",
                        labextensions_path=labextensions_path,
                        overrides=None,
                    )
                    servers = settings.get("settings", {}).get("mcpSettings", {}).get("mcp_servers", [])
                    return {"mcp_servers": servers} if servers else None
                except Exception as e:
                    if self.log:
                        self.log.warning(f"Failed to load JupyterLab settings via get_settings: {e}", exc_info=True)
            elif self.log:
                missing = [a for a in ('app_settings_dir', 'schemas_dir', 'user_settings_dir', 'labextensions_path')
                           if not getattr(self.lab_server_app, a, None)]
                self.log.warning(f"serverapp missing required attributes: {missing}")

        # Fallback: load directly from the settings file
        settings_path = self._get_lab_settings_path()
        if not settings_path:
            return None

        try:
            import json5
            with open(settings_path, 'r', encoding='utf-8') as f:
                data = json5.load(f)
        except (ImportError, Exception):
            try:
                with open(settings_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception as e:
                if self.log:
                    self.log.warning(f"Failed to load JupyterLab settings from {settings_path}: {e}")
                return None

        servers = data.get("mcpSettings", {}).get("mcp_servers", [])
        return {"mcp_servers": servers} if servers else None

    def add_server(self, server: dict) -> None:
        """Register a server dict directly. Lower priority than config files."""
        self._extra_servers.append(server)
        self.clear_cache()

    def _load_config_file_servers(self) -> dict:
        """Load and merge config-file servers (no lab settings)."""
        configs = []
        if self._extra_servers:
            configs.append({"mcp_servers": self._extra_servers})
        for config_file in self._get_config_file_paths():
            config = self._load_config_from_file(config_file)
            if config:
                configs.append(config)
        return self._merge_configs(configs)

    def _load_all_configs(self) -> dict:
        """Load and merge all configuration sources including lab settings."""
        config_file_servers = [s.model_dump() for s in self.get_config_file_servers()]
        configs = [{"mcp_servers": config_file_servers}]
        lab_settings = self._load_lab_settings()
        if lab_settings:
            configs.append(lab_settings)
        return self._merge_configs(configs)

    def get_config_file_servers(self) -> List[Union[McpServerStdio, McpServerHttp]]:
        """Get servers from config files only — excludes lab settings.

        Used by the REST API so that lab-settings servers are managed solely
        by the frontend via the JupyterLab settings registry.
        """
        if self._config_file_cache is not None:
            return self._config_file_cache.mcp_servers
        try:
            self._config_file_cache = McpSettings(**self._load_config_file_servers())
            return self._config_file_cache.mcp_servers
        except Exception:
            return []

    def get_settings(self) -> McpSettings:
        """Get MCP settings merged from all sources."""
        if self._all_servers_cache is not None:
            return self._all_servers_cache
        try:
            self._all_servers_cache = McpSettings(**self._load_all_configs())
            if self.log:
                self.log.info(f"Loaded {len(self._all_servers_cache.mcp_servers)} MCP servers")
            return self._all_servers_cache
        except Exception as e:
            if self.log:
                self.log.error(f"Failed to parse MCP configuration: {e}")
            return McpSettings(mcp_servers=[])

    def get_servers(self) -> List[Union[McpServerStdio, McpServerHttp]]:
        """Get all configured MCP servers merged from all sources."""
        return self.get_settings().mcp_servers

    def get_server_by_name(self, name: str) -> Optional[Union[McpServerStdio, McpServerHttp]]:
        """Get a specific MCP server by its name."""
        for server in self.get_servers():
            if server.name == name:
                return server
        return None

    def clear_cache(self) -> None:
        """Clear all caches so next access will reload from disk."""
        self._config_file_cache = None
        self._all_servers_cache = None
        if self.log:
            self.log.info("MCP server manager cache cleared")

    def add_observer(self, callback: Callable[[], Union[None, Awaitable[None]]]) -> None:
        """Register a callback to be called when lab settings change."""
        if callback not in self._observers:
            self._observers.append(callback)

    def remove_observer(self, callback: Callable[[], Union[None, Awaitable[None]]]) -> None:
        """Unregister a previously registered callback."""
        try:
            self._observers.remove(callback)
        except ValueError:
            pass

    async def notify_observers(self) -> None:
        """Call all registered observers, awaiting async ones."""
        for callback in list(self._observers):
            try:
                result = callback()
                if asyncio.iscoroutine(result):
                    await result
            except Exception as e:
                if self.log:
                    self.log.error(f"MCP observer error: {e}")

    def add_config_dir(self, directory: str) -> None:
        """Add a directory to search for configuration files."""
        if directory not in self.config_dirs:
            self.config_dirs.append(directory)
        self.clear_cache()

    def add_config_path(self, file_path: str) -> None:
        """Add a specific config file path to load."""
        if file_path not in self.extra_config_paths:
            self.extra_config_paths.append(file_path)
        self.clear_cache()

    def get_user_config_path(self) -> str:
        """Get the user-level config file path for MCP servers."""
        # Find the user config directory (last non-empty in the list)
        user_config_dir = None
        for config_dir in reversed(self.config_dirs):
            if config_dir and os.path.exists(config_dir):
                user_config_dir = config_dir
                break

        if user_config_dir is None:
            # Fallback to ~/.jupyter
            user_config_dir = os.path.expanduser("~/.jupyter")
            os.makedirs(user_config_dir, exist_ok=True)

        return os.path.join(user_config_dir, "mcp_servers.json")

    def save_user_config(self, servers: List[dict]) -> bool:
        """Save user-level MCP server configuration."""
        config_path = self.get_user_config_path()
        config = {"mcp_servers": servers}

        try:
            config_dir = os.path.dirname(config_path)
            os.makedirs(config_dir, exist_ok=True)

            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2)

            self.clear_cache()
            if self.log:
                self.log.info(f"Saved user MCP server configuration to {config_path}")
            return True
        except (IOError, OSError) as e:
            if self.log:
                self.log.error(f"Failed to save user MCP config to {config_path}: {e}")
            return False

    def get_user_servers(self) -> List[dict]:
        """Get user-level MCP server configurations as raw dicts."""
        config_path = self.get_user_config_path()
        if not os.path.exists(config_path):
            return []

        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                return config.get("mcp_servers", [])
        except (json.JSONDecodeError, IOError, OSError):
            return []


def get_mcp_manager(
    log=None,
    extra_config_paths: Optional[List[str]] = None,
    lab_server_app=None
) -> McpServerManager:
    """
    Create and return an MCP server manager instance.

    Args:
        log: Logger instance
        extra_config_paths: Additional config file paths
        lab_server_app: The JupyterLab server application

    Returns:
        McpServerManager: Configured MCP server manager
    """
    return McpServerManager(
        log=log,
        extra_config_paths=extra_config_paths,
        lab_server_app=lab_server_app
    )
