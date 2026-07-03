import { ServerConnection } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ArrayExt } from '@lumino/algorithm';
import { JSONExt, ReadonlyJSONObject } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';

import { requestAPI } from './request';
import { IMcpManager, IMcpServer, IMcpServerEntry } from './tokens';

/**
 * Implementation of the MCP manager.
 * This is the source of truth for MCP server configurations.
 * It reads from both JupyterLab settings and backend config,
 * and emits signals when the configuration changes.
 */
export class McpManager implements IMcpManager {
  constructor(options: McpManager.IOptions) {
    this._serverSettings = options.serverSettings;
    this._servers = [];
    this._backendServers = [];
    this._settings = options.settings ?? null;

    if (this._settings) {
      this._settings.changed.connect(() => this._rebuildMergedList(), this);
    }

    this._loadBackendServers(true).then(() => this._rebuildMergedList(true));
  }

  /**
   * Emitted when the merged server list changes.
   */
  get serversChanged(): ISignal<IMcpManager, void> {
    return this._serversChanged;
  }

  /**
   * Emitted when the raw backend server list changes.
   */
  get backendServersChanged(): ISignal<IMcpManager, void> {
    return this._backendServersChanged;
  }

  private async _notifyBackend(): Promise<void> {
    try {
      await requestAPI<void>('notify', this._serverSettings, {
        method: 'POST'
      });
    } catch {
      // Backend unavailable
    }
  }

  /**
   * Fetch backend config-file servers from the REST API and emit
   * backendServersChanged if the list changed.
   */
  private async _loadBackendServers(reload: boolean = false): Promise<void> {
    try {
      const data = await requestAPI<{ mcp_servers: IMcpServerEntry[] }>(
        `servers${reload ? '?reload=1' : ''}`,
        this._serverSettings
      );
      const newBackend = data.mcp_servers.map(s => ({
        ...s,
        deletable: false,
        source: 'backend' as const
      }));

      const changed = !ArrayExt.shallowEqual(
        newBackend,
        this._backendServers,
        (a, b) =>
          JSONExt.deepEqual(
            a as unknown as ReadonlyJSONObject,
            b as unknown as ReadonlyJSONObject
          )
      );

      if (changed) {
        this._backendServers = newBackend;
        this._backendServersChanged.emit();
      }
    } catch {
      // Backend unavailable
    }
  }

  /**
   * Rebuild the merged server list from current settings + cached backend servers.
   * Emits serversChanged if the result differs.
   */
  private _rebuildMergedList(init: boolean = false): void {
    const settingsServers: IMcpServerEntry[] = [];

    if (this._settings) {
      const mcpSettings = this._settings.get('mcpSettings').composite as {
        mcp_servers?: IMcpServer[];
      } | null;
      for (const server of mcpSettings?.mcp_servers ?? []) {
        settingsServers.push({
          ...server,
          editable: true,
          deletable: true,
          source: 'settings',
          config_file: ''
        });
      }
    }

    const settingsNames = new Set(settingsServers.map(s => s.name));
    const backendServers = this._backendServers.filter(
      s => !settingsNames.has(s.name)
    );

    const newServers = [...settingsServers, ...backendServers].sort((a, b) =>
      a.name < b.name ? -1 : 1
    );
    const previousServers = [...this._servers].sort((a, b) =>
      a.name < b.name ? -1 : 1
    );

    const serversChanged = !ArrayExt.shallowEqual(
      newServers,
      previousServers,
      (a, b) =>
        JSONExt.deepEqual(
          a as unknown as ReadonlyJSONObject,
          b as unknown as ReadonlyJSONObject
        )
    );

    if (serversChanged || init) {
      this._servers = newServers;
      this._serversChanged.emit();
    }

    if (serversChanged) {
      this._notifyBackend();
    }
  }

  /**
   * Merged list of all servers (settings + backend).
   * Intended for external consumers such as MCP clients.
   */
  getMCPServers(): IMcpServerEntry[] {
    return this._servers;
  }

  /**
   * Get an MCP server given its name.
   */
  getMCPServer(name: string): IMcpServerEntry | null {
    return this._servers.find(s => s.name === name) ?? null;
  }

  /**
   * Raw list of backend config-file servers.
   * Intended for the settings panel.
   */
  getBackendMCPServers(): IMcpServerEntry[] {
    return this._backendServers;
  }

  /**
   * Persist a backend server via the REST API and refresh the backend list.
   */
  async saveBackendServer(server: IMcpServer): Promise<void> {
    await requestAPI<void>('servers', this._serverSettings, {
      method: 'PUT',
      body: JSON.stringify(server),
      headers: { 'Content-Type': 'application/json' }
    });
    await this._loadBackendServers(true);
    this._rebuildMergedList();
  }

  /**
   * Refresh the list of backend servers.
   */
  async refresh(): Promise<void> {
    await this._loadBackendServers(true);
    this._rebuildMergedList();
  }

  private _serverSettings: ServerConnection.ISettings;
  private _settings: ISettingRegistry.ISettings | null;
  private _servers: IMcpServerEntry[];
  private _backendServers: IMcpServerEntry[];
  private _serversChanged = new Signal<IMcpManager, void>(this);
  private _backendServersChanged = new Signal<IMcpManager, void>(this);
}

/**
 * The MCP manager namespace.
 */
export namespace McpManager {
  /**
   * The options for the MCP manager constructor.
   */
  export interface IOptions {
    serverSettings: ServerConnection.ISettings;
    settings?: ISettingRegistry.ISettings;
  }
}
