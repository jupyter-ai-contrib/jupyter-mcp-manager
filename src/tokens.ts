import { Token } from '@lumino/coreutils';
import { ISignal } from '@lumino/signaling';

/**
 * The plugin ids.
 */
export const PLUGIN_IDS = {
  manager: 'jupyter-mcp-manager:manager'
};

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
  disabled?: boolean;
}

export interface IMcpServerHttp {
  type: 'http';
  name: string;
  url: string;
  headers?: IHttpHeader[];
  disabled?: boolean;
}

export type IMcpServer = IMcpServerStdio | IMcpServerHttp;

/**
 * Thin overlay stored in settings to disable a backend server without copying
 * its full config. Identified by the absence of `type`.
 */
export interface IMcpServerDisabledOverlay {
  name: string;
  disabled: boolean;
}

/** Union of what can appear in the settings `mcp_servers` array. */
export type IMcpServerSettings = IMcpServer | IMcpServerDisabledOverlay;

/**
 * Server entry including UI metadata (not part of the saved schema).
 */
export type IMcpServerEntry = IMcpServer & {
  editable: boolean;
  deletable: boolean;
  source: 'settings' | 'backend';
  config_file: string;
};

/**
 * Read-only aggregator for MCP server configurations.
 * Mutations are handled by the settings panel directly.
 */
export interface IMcpManager {
  /**
   * Merged list of all servers (settings + backend).
   * Intended for external consumers such as MCP clients.
   */
  getMCPServers(): IMcpServerEntry[];
  /**
   * Get an MCP server given its name.
   */
  getMCPServer(name: string): IMcpServerEntry | null;
  /**
   * Raw list of backend config-file servers.
   * Intended for the settings panel.
   */
  getBackendMCPServers(): IMcpServerEntry[];
  /**
   * Persist a backend server via the REST API and refresh the backend list.
   */
  saveBackendServer(server: IMcpServer): Promise<void>;
  /**
   * Refresh the list of backend servers.
   */
  refresh(): Promise<void>;
  /**
   * Emitted when the merged server list changes.
   */
  serversChanged: ISignal<IMcpManager, void>;
  /**
   * Emitted when the raw backend server list changes.
   */
  backendServersChanged: ISignal<IMcpManager, void>;
}

export const IMcpManager = new Token<IMcpManager>(
  'jupyter-mcp-manager:IMcpManager'
);
