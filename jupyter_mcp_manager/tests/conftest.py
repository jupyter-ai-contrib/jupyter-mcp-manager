from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def isolate_lab_data_dir(tmp_path):
    """Isolate all Jupyter config/data paths for every test.

    - jupyter_config_path → [] so no real mcp_servers.json files are loaded
    - jupyter_data_dir    → tmp_path so no real plugin.json is loaded

    Tests that need real config files create them under tmp_path or via
    extra_config_paths / add_config_dir().
    """
    with patch(
        "jupyter_mcp_manager.mcp_manager.jupyter_config_path",
        return_value=[],
    ):
        with patch(
            "jupyter_mcp_manager.mcp_manager.jupyter_config_dir",
            return_value=str(tmp_path),
        ):
            yield tmp_path
