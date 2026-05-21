# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

import json

from jupyter_server.base.handlers import APIHandler
import tornado


class McpServersHandler(APIHandler):
    """Handler for getting all configured MCP servers."""

    @tornado.web.authenticated
    def get(self):
        """Get all configured MCP servers."""
        manager = self.settings["mcp_manager"]
        if self.get_query_argument("reload", default=None):
            manager.clear_cache()
        settings = manager.get_settings()

        # Get user-level servers to mark them as editable
        user_servers = manager.get_user_servers()
        user_server_names = {s.get("name") for s in user_servers}
        source_map = manager.get_server_source_map()
        user_config_path = manager.get_user_config_path()

        # Convert to JSON-serializable format with editable and config_file flags
        servers = []
        for server in settings.mcp_servers:
            server_dict = server.model_dump()
            is_editable = server.name in user_server_names
            server_dict["editable"] = is_editable
            server_dict["config_file"] = source_map.get(
                server.name, user_config_path if is_editable else ""
            )
            servers.append(server_dict)

        self.finish(json.dumps({
            "mcp_servers": servers,
            "count": len(servers)
        }))

    @tornado.web.authenticated
    def post(self):
        """Save user-level MCP server configurations."""
        manager = self.settings["mcp_manager"]

        try:
            body = json.loads(self.request.body.decode('utf-8'))
        except json.JSONDecodeError:
            self.set_status(400)
            self.finish(json.dumps({"error": "Invalid JSON body"}))
            return

        if "mcp_servers" not in body:
            self.set_status(400)
            self.finish(json.dumps({"error": "Missing mcp_servers field"}))
            return

        servers = body["mcp_servers"]
        if manager.save_user_config(servers):
            self.finish(json.dumps({"status": "ok", "message": "Configuration saved"}))
        else:
            self.set_status(500)
            self.finish(json.dumps({"error": "Failed to save configuration"}))

    @tornado.web.authenticated
    def put(self):
        """Update or add a specific MCP server in user configuration."""
        manager = self.settings["mcp_manager"]

        try:
            body = json.loads(self.request.body.decode('utf-8'))
        except json.JSONDecodeError:
            self.set_status(400)
            self.finish(json.dumps({"error": "Invalid JSON body"}))
            return

        if "name" not in body:
            self.set_status(400)
            self.finish(json.dumps({"error": "Missing server name"}))
            return

        user_servers = manager.get_user_servers()
        server_name = body["name"]

        # Find existing server by name
        existing_index = None
        for i, server in enumerate(user_servers):
            if server.get("name") == server_name:
                existing_index = i
                break

        if existing_index is not None:
            user_servers[existing_index] = body
        else:
            user_servers.append(body)

        if manager.save_user_config(user_servers):
            self.finish(json.dumps({"status": "ok", "message": "Server updated"}))
        else:
            self.set_status(500)
            self.finish(json.dumps({"error": "Failed to save server"}))

    @tornado.web.authenticated
    def delete(self):
        """Delete a specific MCP server from user configuration."""
        manager = self.settings["mcp_manager"]

        server_name = self.get_query_argument("name", default=None)
        if not server_name:
            self.set_status(400)
            self.finish(json.dumps({"error": "Missing server name parameter"}))
            return

        user_servers = manager.get_user_servers()
        new_servers = [s for s in user_servers if s.get("name") != server_name]

        if len(new_servers) == len(user_servers):
            self.set_status(404)
            self.finish(json.dumps({"error": f"Server '{server_name}' not found in user config"}))
            return

        if manager.save_user_config(new_servers):
            self.finish(json.dumps({"status": "ok", "message": "Server deleted"}))
        else:
            self.set_status(500)
            self.finish(json.dumps({"error": "Failed to delete server"}))


class McpServerHandler(APIHandler):
    """Handler for getting a specific MCP server by name."""

    @tornado.web.authenticated
    def get(self, server_name: str):
        """Get a specific MCP server configuration by name."""
        manager = self.settings["mcp_manager"]
        server = manager.get_server_by_name(server_name)

        if server is None:
            self.set_status(404)
            self.finish(json.dumps({
                "error": f"MCP server '{server_name}' not found"
            }))
            return

        self.finish(json.dumps(server.model_dump()))
