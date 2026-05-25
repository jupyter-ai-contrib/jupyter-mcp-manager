import type { RJSFSchema } from '@rjsf/utils';
/**
 * Token and interfaces for MCP server management.
 */

export interface IEnvVariable {
  name: string;
  value: string;
}

export interface IHttpHeader {
  name: string;
  value: string;
}

export interface IMcpServerStdio {
  type: 'stdio';
  name: string;
  command: string;
  args?: string[];
  env?: IEnvVariable[];
}

export interface IMcpServerHttp {
  type: 'http';
  name: string;
  url: string;
  headers?: IHttpHeader[];
}

/**
 * Union type for MCP servers (stdio or http)
 */
export type IMcpServer = IMcpServerStdio | IMcpServerHttp;

/**
 * Server entry as returned by the API or settings registry, including UI metadata.
 * editable, deletable, source, and config_file are not part of the saved schema.
 */
export type IMcpServerEntry = IMcpServer & {
  editable: boolean;
  deletable: boolean;
  source: 'settings' | 'backend';
  config_file: string;
};

/**
 * Interface for MCP server settings
 */
export interface IMcpSettings extends RJSFSchema {
  mcp_servers: IMcpServer[];
}
