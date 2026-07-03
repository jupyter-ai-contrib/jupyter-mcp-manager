import React, { useState, useEffect } from 'react';
import { IRenderMime } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator } from '@jupyterlab/translation';
import {
  Button,
  checkIcon,
  closeIcon,
  deleteIcon,
  editIcon,
  refreshIcon,
  settingsIcon
} from '@jupyterlab/ui-components';

import {
  IEnvVariable,
  IHttpHeader,
  IMcpManager,
  IMcpServerEntry,
  IMcpServerHttp,
  IMcpServerSettings,
  IMcpServerStdio
} from './tokens';

interface IMcpServerPanelProps {
  manager: IMcpManager;
  settings: ISettingRegistry.ISettings;
  translator: ITranslator;
}

interface IServerTableProps {
  servers: IMcpServerEntry[];
  onDelete: (name: string) => void;
  onSave: (server: IMcpServerEntry) => void;
  onRefresh: () => void;
  onToggleDisabled: (server: IMcpServerEntry) => void;
  trans: IRenderMime.TranslationBundle;
}

interface IRowProps {
  server: IMcpServerEntry;
  isEditing: boolean;
  isNew?: boolean;
  onStartEdit: () => void;
  onSave: (server: IMcpServerEntry) => void;
  onCancel: () => void;
  onDelete: (name: string) => void;
  onOpenAdvanced: () => void;
  onToggleDisabled: (server: IMcpServerEntry) => void;
  trans: IRenderMime.TranslationBundle;
}

interface IAdvancedSettingsPopupProps {
  server: IMcpServerEntry;
  onClose: () => void;
  onSave: (server: IMcpServerEntry) => void;
  trans: IRenderMime.TranslationBundle;
}

const EMPTY_STDIO: IMcpServerEntry = {
  name: '',
  type: 'stdio',
  command: '',
  editable: true,
  deletable: true,
  source: 'settings',
  config_file: ''
};

const AdvancedSettingsPopup: React.FC<IAdvancedSettingsPopupProps> = ({
  server,
  onClose,
  onSave,
  trans
}) => {
  const stdioServer =
    server.type === 'stdio'
      ? (server as IMcpServerStdio & IMcpServerEntry)
      : null;
  const httpServer =
    server.type === 'http'
      ? (server as IMcpServerHttp & IMcpServerEntry)
      : null;
  const isEditable = server.editable;

  const [args, setArgs] = useState<string[]>(stdioServer?.args ?? []);
  const [env, setEnv] = useState<IEnvVariable[]>(stdioServer?.env ?? []);
  const [headers, setHeaders] = useState<IHttpHeader[]>(
    httpServer?.headers ?? []
  );

  useEffect(() => {
    setArgs(stdioServer?.args ?? []);
    setEnv(stdioServer?.env ?? []);
    setHeaders(httpServer?.headers ?? []);
  }, [server]);

  const handleSave = () => {
    if (stdioServer) {
      onSave({ ...stdioServer, args, env });
    } else if (httpServer) {
      onSave({ ...httpServer, headers });
    }
  };

  const addArg = () => setArgs([...args, '']);
  const updateArg = (i: number, value: string) => {
    const next = [...args];
    next[i] = value;
    setArgs(next);
  };
  const removeArg = (i: number) => setArgs(args.filter((_, j) => j !== i));

  const addEnv = () => setEnv([...env, { name: '', value: '' }]);
  const updateEnv = (i: number, field: 'name' | 'value', value: string) => {
    const next = [...env];
    next[i] = { ...next[i], [field]: value };
    setEnv(next);
  };
  const removeEnv = (i: number) => setEnv(env.filter((_, j) => j !== i));

  const addHeader = () => setHeaders([...headers, { name: '', value: '' }]);
  const updateHeader = (i: number, field: 'name' | 'value', value: string) => {
    const next = [...headers];
    next[i] = { ...next[i], [field]: value };
    setHeaders(next);
  };
  const removeHeader = (i: number) =>
    setHeaders(headers.filter((_, j) => j !== i));

  const originLabel =
    server.source === 'settings'
      ? trans.__('JupyterLab Settings')
      : isEditable
        ? trans.__('User config')
        : trans.__('System config');

  return (
    <div className="jp-mcp-popup-overlay" onClick={onClose}>
      <div
        className="jp-mcp-popup"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
          }
        }}
      >
        <div className="jp-mcp-popup-header">
          <span>
            {server.name} — {trans.__('Advanced Settings')}
          </span>
          <Button onClick={onClose} title={trans.__('Close')}>
            <closeIcon.react />
          </Button>
        </div>
        <div className="jp-mcp-popup-body">
          {stdioServer && (
            <>
              <div className="jp-mcp-popup-section">
                <h4>{trans.__('Arguments')}</h4>
                {!args.length && (
                  <em className="jp-mcp-empty">{trans.__('No arguments.')}</em>
                )}
                {args.map((arg, i) => (
                  <div key={i} className="jp-mcp-arg-row">
                    <input
                      value={arg}
                      disabled={!isEditable}
                      onChange={e => updateArg(i, e.target.value)}
                    />
                    {isEditable && (
                      <Button
                        onClick={() => removeArg(i)}
                        title={trans.__('Remove')}
                      >
                        <closeIcon.react />
                      </Button>
                    )}
                  </div>
                ))}
                {isEditable && (
                  <button
                    type="button"
                    className="jp-mod-styled jp-mod-reject jp-ArrayOperationsButton"
                    onClick={addArg}
                  >
                    {trans.__('Add')}
                  </button>
                )}
              </div>
              <div className="jp-mcp-popup-section">
                <h4>{trans.__('Environment Variables')}</h4>
                {!env.length && (
                  <em className="jp-mcp-empty">
                    {trans.__('No environment variables.')}
                  </em>
                )}
                {env.map((envVar, i) => (
                  <div key={i} className="jp-mcp-kv-row">
                    <input
                      value={envVar.name}
                      placeholder={trans.__('Name')}
                      disabled={!isEditable}
                      onChange={e => updateEnv(i, 'name', e.target.value)}
                    />
                    <input
                      value={envVar.value}
                      placeholder={trans.__('Value')}
                      disabled={!isEditable}
                      onChange={e => updateEnv(i, 'value', e.target.value)}
                    />
                    {isEditable && (
                      <Button
                        onClick={() => removeEnv(i)}
                        title={trans.__('Remove')}
                      >
                        <closeIcon.react />
                      </Button>
                    )}
                  </div>
                ))}
                {isEditable && (
                  <button
                    type="button"
                    className="jp-mod-styled jp-mod-reject jp-ArrayOperationsButton"
                    onClick={addEnv}
                  >
                    {trans.__('Add')}
                  </button>
                )}
              </div>
            </>
          )}
          {httpServer && (
            <div className="jp-mcp-popup-section">
              <h4>{trans.__('HTTP Headers')}</h4>
              {!headers.length && (
                <em className="jp-mcp-empty">{trans.__('No HTTP headers.')}</em>
              )}
              {headers.map((header, i) => (
                <div key={i} className="jp-mcp-kv-row">
                  <input
                    value={header.name}
                    placeholder={trans.__('Name')}
                    disabled={!isEditable}
                    onChange={e => updateHeader(i, 'name', e.target.value)}
                  />
                  <input
                    value={header.value}
                    placeholder={trans.__('Value')}
                    disabled={!isEditable}
                    onChange={e => updateHeader(i, 'value', e.target.value)}
                  />
                  {isEditable && (
                    <Button
                      onClick={() => removeHeader(i)}
                      title={trans.__('Remove')}
                    >
                      <closeIcon.react />
                    </Button>
                  )}
                </div>
              ))}
              {isEditable && (
                <button
                  type="button"
                  className="jp-mod-styled jp-mod-reject jp-ArrayOperationsButton"
                  onClick={addHeader}
                >
                  {trans.__('Add')}
                </button>
              )}
            </div>
          )}
          <div className="jp-mcp-popup-section">
            <h4>{trans.__('Config file')}</h4>
            <div className="jp-mcp-origin">{originLabel}</div>
            {server.config_file && (
              <div className="jp-mcp-config-file">{server.config_file}</div>
            )}
          </div>
        </div>
        <div className="jp-mcp-popup-footer">
          <button
            type="button"
            className="jp-mod-styled jp-mod-reject"
            onClick={onClose}
          >
            {trans.__('Cancel')}
          </button>
          {isEditable && (
            <button
              type="button"
              className="jp-mod-styled jp-mod-accept"
              onClick={handleSave}
            >
              {trans.__('Save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<IRowProps> = ({
  server,
  isEditing,
  isNew,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  onOpenAdvanced,
  onToggleDisabled,
  trans
}) => {
  const [draft, setDraft] = useState<IMcpServerEntry>({ ...server });

  useEffect(() => {
    if (isEditing) {
      setDraft({ ...server });
    }
  }, [isEditing]);

  const setDraftType = (type: 'stdio' | 'http') => {
    if (type === 'stdio') {
      setDraft({
        name: draft.name,
        type: 'stdio',
        command: '',
        editable: draft.editable,
        deletable: draft.deletable,
        source: draft.source,
        config_file: draft.config_file
      });
    } else {
      setDraft({
        name: draft.name,
        type: 'http',
        url: '',
        editable: draft.editable,
        deletable: draft.deletable,
        source: draft.source,
        config_file: draft.config_file
      });
    }
  };

  const handleSave = () => {
    if (isNew && !draft.name) return;
    onSave(draft);
  };

  if (!isEditing) {
    return (
      <tr className={server.disabled ? 'jp-mcp-disabled' : ''}>
        <td>{server.name}</td>
        <td>{server.type || 'stdio'}</td>
        <td>{server.type === 'stdio' ? server.command : server.url}</td>
        <td>
          <input
            type="checkbox"
            checked={!server.disabled}
            onChange={() => onToggleDisabled(server)}
            title={server.disabled ? trans.__('Enable') : trans.__('Disable')}
            className="jp-mcp-enabled-checkbox"
          />
          <Button
            onClick={onStartEdit}
            title={trans.__('Edit')}
            style={{ visibility: server.editable ? 'visible' : 'hidden' }}
          >
            <editIcon.react />
          </Button>
          <Button
            onClick={onOpenAdvanced}
            title={trans.__('Advanced settings')}
          >
            <settingsIcon.react />
          </Button>
          <Button
            onClick={() => onDelete(server.name)}
            title={trans.__('Delete')}
            style={{ visibility: server.deletable ? 'visible' : 'hidden' }}
          >
            <deleteIcon.react />
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>
        {isNew ? (
          <input
            value={draft.name}
            placeholder={trans.__('Name')}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
          />
        ) : (
          draft.name
        )}
      </td>
      <td>
        <select
          value={draft.type}
          onChange={e => setDraftType(e.target.value as 'stdio' | 'http')}
        >
          <option value="stdio">{trans.__('stdio')}</option>
          <option value="http">{trans.__('http')}</option>
        </select>
      </td>
      <td>
        {draft.type === 'stdio' ? (
          <input
            value={draft.command}
            onChange={e => setDraft({ ...draft, command: e.target.value })}
          />
        ) : (
          <input
            value={draft.url}
            onChange={e =>
              setDraft({
                ...(draft as IMcpServerHttp & IMcpServerEntry),
                url: e.target.value
              })
            }
          />
        )}
      </td>
      <td>
        <Button onClick={handleSave} title={trans.__('Save')}>
          <checkIcon.react />
        </Button>
        <Button onClick={onCancel} title={trans.__('Cancel')}>
          <closeIcon.react />
        </Button>
      </td>
    </tr>
  );
};

const ServerTable: React.FC<IServerTableProps> = ({
  servers,
  onDelete,
  onSave,
  onRefresh,
  onToggleDisabled,
  trans
}) => {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [advancedServer, setAdvancedServer] = useState<IMcpServerEntry | null>(
    null
  );

  const startEdit = (name: string) => {
    setEditingName(name);
    setIsAdding(false);
  };

  const startAdd = () => {
    setEditingName(null);
    setIsAdding(true);
  };

  const stopEditing = () => {
    setEditingName(null);
    setIsAdding(false);
  };

  const handleSave = (server: IMcpServerEntry) => {
    onSave(server);
    stopEditing();
  };

  const handleAdvancedSave = (server: IMcpServerEntry) => {
    onSave(server);
    setAdvancedServer(null);
  };

  return (
    <>
      <table className="jp-mcp-table">
        <thead>
          <tr>
            <th>{trans.__('Name')}</th>
            <th>{trans.__('Type')}</th>
            <th>{trans.__('Command/URL')}</th>
            <th>
              {trans.__('Actions')}
              <Button
                onClick={onRefresh}
                title={trans.__('Refresh server list')}
              >
                <refreshIcon.react />
              </Button>
            </th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 && !isAdding && (
            <tr>
              <td colSpan={4} className="jp-mcp-empty">
                {trans.__('No servers configured.')}
              </td>
            </tr>
          )}
          {servers.map(server => (
            <Row
              key={server.name}
              server={server}
              isEditing={editingName === server.name}
              onStartEdit={() => startEdit(server.name)}
              onSave={handleSave}
              onCancel={stopEditing}
              onDelete={onDelete}
              onOpenAdvanced={() => setAdvancedServer(server)}
              onToggleDisabled={onToggleDisabled}
              trans={trans}
            />
          ))}
          {isAdding && (
            <Row
              key="__new__"
              server={{ ...EMPTY_STDIO }}
              isEditing={true}
              isNew={true}
              onStartEdit={() => {}}
              onSave={handleSave}
              onCancel={stopEditing}
              onDelete={onDelete}
              onOpenAdvanced={() => {}}
              onToggleDisabled={() => {}}
              trans={trans}
            />
          )}
        </tbody>
      </table>
      <button
        type="button"
        className="jp-mod-styled jp-mod-reject jp-ArrayOperationsButton"
        onClick={startAdd}
      >
        {trans.__('Add')}
      </button>
      {advancedServer && (
        <AdvancedSettingsPopup
          server={advancedServer}
          onClose={() => setAdvancedServer(null)}
          onSave={handleAdvancedSave}
          trans={trans}
        />
      )}
    </>
  );
};

export const McpServersSettings: React.FC<IMcpServerPanelProps> = ({
  manager,
  settings,
  translator
}) => {
  const trans = translator.load('jupyter-mcp-manager');
  const [error, setError] = useState<string | null>(null);

  // Settings servers and overlay map — initialized synchronously, updated via settings.changed
  const [settingsMCP, setSettingsMCP] = useState<IMcpServerEntry[]>(
    () => Private.parseSettingsMCP(settings).servers
  );
  const [overlayMap, setOverlayMap] = useState<Map<string, boolean>>(
    () => Private.parseSettingsMCP(settings).overlayMap
  );

  // Backend servers — provided by the manager, updated via backendServersChanged
  const [backendMCP, setBackendMCP] = useState<IMcpServerEntry[]>(
    manager.getBackendMCPServers()
  );

  // Subscribe to settings changes
  useEffect(() => {
    const handleSettingsChanged = () => {
      const parsed = Private.parseSettingsMCP(settings);
      setSettingsMCP(parsed.servers);
      setOverlayMap(parsed.overlayMap);
    };

    settings.changed.connect(handleSettingsChanged);
    return () => {
      settings.changed.disconnect(handleSettingsChanged);
    };
  }, [settings]);

  // Subscribe to backend server changes and trigger an initial fetch
  useEffect(() => {
    const handleBackendChanged = () => {
      setBackendMCP(manager.getBackendMCPServers());
    };

    manager.backendServersChanged.connect(handleBackendChanged);
    manager.refresh();

    return () => {
      manager.backendServersChanged.disconnect(handleBackendChanged);
    };
  }, [manager]);

  // Merged display list: settings servers take precedence; overlays apply disabled state to backend servers
  const settingsNames = new Set(settingsMCP.map(s => s.name));
  const servers: IMcpServerEntry[] = [
    ...settingsMCP,
    ...backendMCP
      .filter(s => !settingsNames.has(s.name))
      .map(s =>
        overlayMap.has(s.name) ? { ...s, disabled: overlayMap.get(s.name) } : s
      )
  ].sort((a, b) => (a.name < b.name ? -1 : 1));

  /**
   * Save an MCP server (new or updated).
   * If the settings comes from backend, delegate it to the manager,
   * otherwise update the settings from the registry.
   */
  const handleSave = async (entry: IMcpServerEntry) => {
    const {
      editable,
      deletable,
      source,
      config_file,
      disabled,
      ...serverCore
    } = entry as IMcpServerEntry & { disabled?: boolean };
    try {
      if (source === 'backend') {
        // disabled state lives in the overlay, not the server config
        await manager.saveBackendServer(serverCore);
      } else {
        const server = disabled ? { ...serverCore, disabled } : serverCore;
        const list = Private.getSettingsList(settings);
        const idx = list.findIndex(s => s.name === entry.name);
        const updated =
          idx >= 0
            ? list.map((s, i) => (i === idx ? server : s))
            : [...list, server];
        await Private.writeSettingsList(settings, updated);
      }
    } catch {
      setError(trans.__('Failed to save server'));
    }
  };

  /**
   * Delete an MCP server, only available for settings coming from the settings registry.
   */
  const handleDelete = async (name: string) => {
    const server = servers.find(s => s.name === name);
    if (server?.source !== 'settings') return;
    try {
      await Private.writeSettingsList(
        settings,
        Private.getSettingsList(settings).filter(s => s.name !== name)
      );
    } catch {
      setError(trans.__('Failed to delete server'));
    }
  };

  /**
   * Toggle the disabled state of a server.
   * For settings servers: updates the `disabled` flag in-place.
   * For backend servers: adds or removes a thin overlay entry in settings.
   */
  const handleToggleDisabled = async (entry: IMcpServerEntry) => {
    try {
      const list = Private.getSettingsList(settings);
      if (entry.source === 'settings') {
        await Private.writeSettingsList(
          settings,
          list.map(s =>
            s.name === entry.name && 'type' in s
              ? { ...s, disabled: !entry.disabled || undefined }
              : s
          )
        );
      } else {
        // Remove any existing overlay for this backend server, then re-add if disabling
        const rest = list.filter(
          s => !(s.name === entry.name && !('type' in s))
        );
        if (!entry.disabled) {
          await Private.writeSettingsList(settings, [
            ...rest,
            { name: entry.name, disabled: true }
          ]);
        } else {
          await Private.writeSettingsList(settings, rest);
        }
      }
    } catch {
      setError(trans.__('Failed to toggle server'));
    }
  };

  /**
   * Refresh the backend MCP server list.
   */
  const handleRefresh = async () => {
    try {
      await manager.refresh();
    } catch {
      setError(trans.__('Failed to refresh servers'));
    }
  };

  if (error) {
    return <div className="jp-Alert jp-Alert-error">{error}</div>;
  }

  return (
    <ServerTable
      servers={servers}
      onDelete={handleDelete}
      onSave={handleSave}
      onRefresh={handleRefresh}
      onToggleDisabled={handleToggleDisabled}
      trans={trans}
    />
  );
};

namespace Private {
  /**
   * Parse settings into server entries and a disabled-overlay map.
   */
  export function parseSettingsMCP(settings: ISettingRegistry.ISettings): {
    servers: IMcpServerEntry[];
    overlayMap: Map<string, boolean>;
  } {
    const mcpSettings = settings.get('mcpSettings').composite as {
      mcp_servers?: IMcpServerSettings[];
    } | null;
    const servers: IMcpServerEntry[] = [];
    const overlayMap = new Map<string, boolean>();
    for (const item of mcpSettings?.mcp_servers ?? []) {
      if ('type' in item) {
        servers.push({
          ...item,
          editable: true,
          deletable: true,
          source: 'settings' as const,
          config_file: ''
        });
      } else {
        overlayMap.set(item.name, item.disabled);
      }
    }
    return { servers, overlayMap };
  }

  /**
   * Get the raw settings list (full entries + thin overlays).
   */
  export const getSettingsList = (
    settings: ISettingRegistry.ISettings
  ): IMcpServerSettings[] => {
    const current = settings.get('mcpSettings').composite as {
      mcp_servers?: IMcpServerSettings[];
    } | null;
    return current?.mcp_servers ?? [];
  };

  /**
   * Write the raw settings list back to the registry.
   */
  export const writeSettingsList = async (
    settings: ISettingRegistry.ISettings,
    list: IMcpServerSettings[]
  ): Promise<void> => {
    await settings.set(
      'mcpSettings',
      JSON.parse(JSON.stringify({ mcp_servers: list }))
    );
  };
}
