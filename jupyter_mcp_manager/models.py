# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

from typing import List, Union

from pydantic import BaseModel, Field


class EnvVariable(BaseModel):
    """Environment variable for MCP server configuration."""
    name: str = Field(description="The name of the environment variable.")
    value: str = Field(description="The value to set for the environment variable.")


class HttpHeader(BaseModel):
    """HTTP header for MCP server configuration."""
    name: str = Field(description="The name of the HTTP header.")
    value: str = Field(description="The value to set for the HTTP header.")


class McpServerStdio(BaseModel):
    """Configuration for a stdio-based MCP server."""
    type: str = "stdio"
    args: List[str] = Field(
        default_factory=list,
        description="Command-line arguments to pass to the MCP server."
    )
    command: str = Field(description="Path to the MCP server executable.")
    env: List[EnvVariable] = Field(
        default_factory=list,
        description="Environment variables to set when launching the MCP server."
    )
    name: str = Field(description="Human-readable name identifying this MCP server.")


class McpServerHttp(BaseModel):
    """Configuration for an HTTP-based MCP server."""
    type: str = "http"
    headers: List[HttpHeader] = Field(
        default_factory=list,
        description="HTTP headers to set when making requests to the MCP server."
    )
    name: str = Field(description="Human-readable name identifying this MCP server.")
    url: str = Field(description="URL to the MCP server.")



class McpSettings(BaseModel):
    """Configuration for MCP servers."""
    mcp_servers: List[Union[McpServerStdio, McpServerHttp]] = Field(
        default_factory=list,
        description="List of MCP server configurations."
    )
