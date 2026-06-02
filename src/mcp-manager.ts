import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ArrayExt } from '@lumino/algorithm';
import { JSONExt, ReadonlyJSONObject } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';

import { requestAPI } from './request';
import { IMcpManager, IMcpServer, IMcpServerEntry, PLUGIN_IDS } from './tokens';

/**
 * Implementation of the MCP manager.
 * This is the source of truth for MCP server configurations.
 * It reads from both JupyterLab settings and backend config,
 * and emits signals when the configuration changes.
 */
export class McpManager implements IMcpManager {
  constructor(serverSettings: any, settingRegistry: ISettingRegistry) {
    this._serverSettings = serverSettings;
    this._servers = [];

    // Listen to settings changes
    settingRegistry.load(PLUGIN_IDS.manager).then(settings => {
      this._settings = settings;
      settings.changed.connect(() => this._loadServers(), this);
      this._loadServers(true);
    });
  }

  /**
   * A signal emitting when the servers has changed.
   */
  get serversChanged(): ISignal<IMcpManager, void> {
    return this._serversChanged;
  }

  /**
   * Reload the servers from settings and config.
   */
  private async _loadServers(
    init: boolean = false,
    reloadBackend: boolean = false
  ): Promise<void> {
    const settingsServers: IMcpServerEntry[] = [];
    const backendServers: IMcpServerEntry[] = [];

    // Load from JupyterLab settings
    if (this._settings) {
      const mcpSettings = this._settings.get('mcpSettings').composite as {
        mcp_servers?: IMcpServer[];
      } | null;
      const servers = mcpSettings?.mcp_servers ?? [];
      for (const server of servers) {
        settingsServers.push({
          ...server,
          editable: true,
          deletable: true,
          source: 'settings' as const,
          config_file: ''
        });
      }
    }

    // Load from backend
    try {
      const data = await requestAPI<{ mcp_servers: IMcpServerEntry[] }>(
        `servers${reloadBackend ? '?reload=1' : ''}`,
        this._serverSettings
      );
      const settingsNames = new Set(settingsServers.map(s => s.name));
      for (const server of data.mcp_servers) {
        if (!settingsNames.has(server.name)) {
          backendServers.push({
            ...server,
            deletable: false,
            source: 'backend' as const
          });
        }
      }
    } catch {
      // Backend unavailable, use settings only
    }

    // Update the list of servers if changed, and emit a signal.
    const newServers = [...settingsServers, ...backendServers].sort((a, b) =>
      a.name < b.name ? -1 : 1
    );
    const previousServers = this._servers.sort((a, b) =>
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
  }

  /**
   * Get all available MCP servers (from both settings and backend config).
   */
  getServers(): IMcpServerEntry[] {
    return this._servers;
  }

  /**
   * Get a specific MCP server by name.
   */
  getServer(name: string): IMcpServerEntry | null {
    return this._servers.find(s => s.name === name) ?? null;
  }

  /**
   * Save MCP server configuration to user settings or config.
   */
  async saveServer(entry: IMcpServerEntry): Promise<void> {
    const { editable, deletable, source, config_file, ...server } = entry;
    if (source === 'backend') {
      this._saveBackendServer(server);
    } else {
      this._saveSettingsServer(server);
    }
  }

  /**
   * Save MCP server configuration to user config.
   */
  private async _saveBackendServer(server: IMcpServer): Promise<void> {
    await requestAPI<any>('servers', this._serverSettings, {
      method: 'PUT',
      body: JSON.stringify(server),
      headers: { 'Content-Type': 'application/json' }
    });
    await this._loadServers();
  }

  /**
   * Save MCP server configuration to user settings.
   */
  private async _saveSettingsServer(server: IMcpServer): Promise<void> {
    if (!this._settings) {
      throw new Error('Settings not loaded');
    }

    const current = this._settings.get('mcpSettings').composite as {
      mcp_servers?: IMcpServer[];
    } | null;
    const list = current?.mcp_servers ?? [];
    const idx = list.findIndex(s => s.name === server.name);
    const updated =
      idx >= 0
        ? list.map((s, i) => (i === idx ? server : s))
        : [...list, server];

    await this._settings.set(
      'mcpSettings',
      JSON.parse(JSON.stringify({ mcp_servers: updated }))
    );
  }

  /**
   * Delete an MCP server from user settings.
   */
  async deleteServer(name: string): Promise<void> {
    if (!this._settings) {
      throw new Error('Settings not loaded');
    }

    const server = this.getServer(name);
    if (server?.source !== 'settings') {
      return;
    }

    const current = this._settings.get('mcpSettings').composite as {
      mcp_servers?: IMcpServer[];
    } | null;
    const updated = (current?.mcp_servers ?? []).filter(s => s.name !== name);

    await this._settings.set(
      'mcpSettings',
      JSON.parse(JSON.stringify({ mcp_servers: updated }))
    );
  }

  /**
   * Refresh the list of MCP servers.
   */
  async refresh(): Promise<void> {
    await this._loadServers(false, true);
  }

  private _serverSettings: any;
  private _settings: ISettingRegistry.ISettings | null = null;
  private _servers: IMcpServerEntry[];
  private _serversChanged = new Signal<IMcpManager, void>(this);
}
