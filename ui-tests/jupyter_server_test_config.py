"""Server configuration for integration tests.

!! Never use this configuration in production because it
opens the server to the world and provide access to JupyterLab
JavaScript objects through the global window variable.
"""
import os
import tempfile

from jupyterlab.galata import configure_jupyter_server

configure_jupyter_server(c)

# Isolate from the user's real Jupyter config so that existing MCP servers
# (e.g. from ~/.jupyter/mcp_servers.json) don't interfere with the tests.
os.environ["JUPYTER_CONFIG_DIR"] = tempfile.mkdtemp()

# Uncomment to set server log level to debug level
# c.ServerApp.log_level = "DEBUG"
