# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import json
import os
from typing import List, Optional, Union

from jupyter_core.paths import jupyter_config_path

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
    - Built-in defaults (lowest priority)
    - System jupyter config directories (/etc/jupyter, /usr/local/etc/jupyter, etc.)
    - User jupyter config directory (~/.jupyter)
    - User-specified paths (highest priority)
    """

    def __init__(
        self,
        log=None,
        builtin_servers: Optional[List[dict]] = None,
        extra_config_paths: Optional[List[str]] = None
    ):
        """
        Initialize the MCP server manager.

        Args:
            log: Logger instance for logging messages
            builtin_servers: List of built-in MCP server configurations (as dicts)
            extra_config_paths: Additional paths to config files to load
        """
        self.log = log
        self.builtin_servers = builtin_servers or []
        self.extra_config_paths = extra_config_paths or []

        # Use Jupyter's config directories
        self.config_dirs = jupyter_config_path()

        # Cache for loaded settings
        self._settings_cache: Optional[McpSettings] = None

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

    def _load_all_configs(self) -> dict:
        """Load and merge all configuration files."""
        configs = []

        # Load built-in servers first (lowest priority)
        if self.builtin_servers:
            configs.append({"mcp_servers": self.builtin_servers})

        # Load from config files
        config_files = self._get_config_file_paths()
        for config_file in config_files:
            config = self._load_config_from_file(config_file)
            if config:
                configs.append(config)

        # Merge all configs
        return self._merge_configs(configs)

    def get_settings(self) -> McpSettings:
        """
        Get the MCP settings by loading and merging all configuration sources.

        Returns:
            McpSettings: The merged MCP server configuration
        """
        if self._settings_cache is not None:
            return self._settings_cache

        merged_config = self._load_all_configs()

        # Validate and parse the configuration
        try:
            settings = McpSettings(**merged_config)
            self._settings_cache = settings

            if self.log:
                self.log.info(
                    f"Loaded MCP settings with {len(settings.mcp_servers)} servers"
                )

            return settings
        except Exception as e:
            if self.log:
                self.log.error(f"Failed to parse MCP configuration: {e}")
            # Return empty settings on error
            return McpSettings(mcp_servers=[])

    def get_servers(self) -> List[Union[McpServerStdio, McpServerHttp]]:
        """Get the list of configured MCP servers."""
        return self.get_settings().mcp_servers

    def get_server_by_name(self, name: str) -> Optional[Union[McpServerStdio, McpServerHttp]]:
        """Get a specific MCP server by its name."""
        for server in self.get_servers():
            if server.name == name:
                return server
        return None

    def clear_cache(self) -> None:
        """Clear the settings cache so next access will reload from disk."""
        self._settings_cache = None
        if self.log:
            self.log.info("MCP server manager cache cleared")

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

    def get_server_source_map(self) -> dict:
        """Return a mapping of server name to the config file it was last loaded from."""
        source_map = {}
        for config_file in self._get_config_file_paths():
            config = self._load_config_from_file(config_file)
            if config:
                for server in config.get("mcp_servers", []):
                    name = server.get("name")
                    if name:
                        source_map[name] = config_file
        return source_map

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
    builtin_servers: Optional[List[dict]] = None,
    extra_config_paths: Optional[List[str]] = None
) -> McpServerManager:
    """
    Create and return an MCP server manager instance.

    This is the main entry point for getting an MCP server manager.

    Args:
        log: Logger instance
        builtin_servers: Built-in server configurations
        extra_config_paths: Additional config file paths

    Returns:
        McpServerManager: Configured MCP server manager
    """
    return McpServerManager(
        log=log,
        builtin_servers=builtin_servers,
        extra_config_paths=extra_config_paths
    )
