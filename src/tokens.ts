import { Token } from '@lumino/coreutils';
import { ISignal } from '@lumino/signaling';

/**
 * The plugin ids.
 */
export const PLUGIN_IDS = {
  manager: 'jupyter-mcp-manager:manager'
};

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
 * Interface for the MCP manager service.
 * This is the source of truth for MCP server configurations.
 */
export interface IMcpManager {
  /**
   * Get all available MCP servers (from both settings and backend config).
   */
  getServers(): IMcpServerEntry[];

  /**
   * Get a specific MCP server by name.
   */
  getServer(name: string): IMcpServerEntry | null;

  /**
   * Save MCP server configuration to user settings.
   */
  saveServer(server: IMcpServerEntry): Promise<void>;

  /**
   * Delete an MCP server from user settings.
   */
  deleteServer(name: string): Promise<void>;

  /**
   * Refresh the list of MCP servers.
   */
  refresh(): Promise<void>;

  /**
   * Event emitted when the list of MCP servers changes.
   */
  serversChanged: ISignal<IMcpManager, void>;
}

/**
 * Token for the MCP manager service.
 */
export const IMcpManager = new Token<IMcpManager>(
  'jupyter-mcp-manager:IMcpManager'
);
