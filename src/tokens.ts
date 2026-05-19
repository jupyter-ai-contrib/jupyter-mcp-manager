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
  editable?: boolean;
}

export interface IMcpServerHttp {
  type: 'http';
  name: string;
  url: string;
  headers?: IHttpHeader[];
  editable?: boolean;
}

/**
 * Union type for MCP servers (stdio or http)
 */
export type IMcpServer = IMcpServerStdio | IMcpServerHttp;

/**
 * Interface for MCP server settings
 */
export interface IMcpSettings extends RJSFSchema {
  mcp_servers: IMcpServer[];
}
