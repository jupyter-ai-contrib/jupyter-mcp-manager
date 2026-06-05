# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from jupyter_server.extension.application import ExtensionApp
from jupyter_server.utils import url_path_join
from traitlets import List, Unicode

try:
    from jupyterlab.labapp import LabServerApp
except ImportError:
    LabServerApp = None

from .mcp_manager import get_mcp_manager
from .handlers import (
    McpNotifyHandler,
    McpServerHandler,
    McpServersHandler,
)


class McpManagerExtension(ExtensionApp):
    """
    Jupyter Server extension for managing MCP servers.

    This extension provides REST API endpoints for:
    - Listing configured MCP servers
    - Getting specific server configurations
    - Reloading configuration
    """

    name = "jupyter_mcp_manager"
    extension_url = "/jupyter-mcp-manager"

    # Configuration traits
    extra_config_paths = List(
        Unicode(),
        help="Additional config file paths to load"
    ).tag(config=True)

    def initialize_settings(self):
        """Initialize extension settings."""
        super().initialize_settings()

    def initialize_handlers(self):
        """Register the API handlers."""
        super().initialize_handlers()

        # Create manager once with extension config and store on server app settings
        # Note: We create the manager here (not in initialize_settings) because
        # self.serverapp is guaranteed to be available at this point
        lab_server_app = None
        if LabServerApp is not None and hasattr(self.serverapp, 'extension_manager') and hasattr(self.serverapp.extension_manager, 'extension_apps'):
            lab_apps = self.serverapp.extension_manager.extension_apps.get("jupyterlab") or []
            lab_server_app = next((app for app in lab_apps if isinstance(app, LabServerApp)), None)
            if lab_server_app is None:
                self.log.info("LabServerApp not available, MCP servers won't be loaded from jupyterlab settings")
        else:
            self.log.info("No extension_manager available, MCP servers won't be loaded from jupyterlab settings")

        manager = get_mcp_manager(
            log=self.log,
            lab_server_app=lab_server_app,
            extra_config_paths=self.extra_config_paths,
        )
        self.serverapp.web_app.settings["mcp_manager"] = manager

        base_url = self.serverapp.web_app.settings["base_url"]
        host_pattern = ".*$"

        # Define route patterns
        servers_route = url_path_join(base_url, "jupyter-mcp-manager", "servers")
        server_route = url_path_join(
            base_url, "jupyter-mcp-manager", "servers", "(?P<server_name>.+)"
        )
        notify_route = url_path_join(base_url, "jupyter-mcp-manager", "notify")

        handlers = [
            (servers_route, McpServersHandler),
            (server_route, McpServerHandler),
            (notify_route, McpNotifyHandler),
        ]

        self.serverapp.web_app.add_handlers(host_pattern, handlers)
        self.log.info(
            "Registered jupyter_mcp_manager extension with endpoints: "
            f"{servers_route}"
        )
