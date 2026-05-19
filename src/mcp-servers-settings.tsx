import React, { useState, useEffect } from 'react';
import { IRenderMime } from '@jupyterlab/rendermime';
import { ServerConnection } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator } from '@jupyterlab/translation';
import {
  Button,
  checkIcon,
  closeIcon,
  deleteIcon,
  editIcon
} from '@jupyterlab/ui-components';

import { requestAPI } from './request';
import { IMcpServer, IMcpServerHttp, IMcpServerStdio } from './tokens';

interface IMcpServerPanelProps {
  settings: ISettingRegistry.ISettings;
  serverSettings: ServerConnection.ISettings;
  translator: ITranslator;
}

interface IServerTableProps {
  servers: IMcpServer[];
  onDelete: (name: string) => void;
  onUpdate: (server: IMcpServer) => void;
  trans: IRenderMime.TranslationBundle;
}

const ServerTable: React.FC<IServerTableProps> = ({
  servers,
  onDelete,
  onUpdate,
  trans
}) => {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [draft, setDraft] = useState<IMcpServer | null>(null);

  const startEdit = (server: IMcpServer) => {
    setEditingName(server.name);
    setDraft({ ...server });
  };

  const cancelEdit = () => {
    setEditingName(null);
    setDraft(null);
  };

  const saveEdit = () => {
    if (draft) {
      onUpdate(draft);
      setEditingName(null);
      setDraft(null);
    }
  };

  const setDraftType = (type: 'stdio' | 'http') => {
    if (!draft) return;
    if (type === 'stdio') {
      setDraft({
        name: draft.name,
        type: 'stdio',
        command: '',
        editable: draft.editable
      });
    } else {
      setDraft({
        name: draft.name,
        type: 'http',
        url: '',
        editable: draft.editable
      });
    }
  };

  if (servers.length === 0) {
    return <p className="jp-mcp-empty">{trans.__('No servers configured.')}</p>;
  }

  return (
    <table className="jp-mcp-table">
      <thead>
        <tr>
          <th>{trans.__('Name')}</th>
          <th>{trans.__('Type')}</th>
          <th>{trans.__('Command/URL')}</th>
          <th>{trans.__('Actions')}</th>
          <th>{trans.__('Origin')}</th>
        </tr>
      </thead>
      <tbody>
        {servers.map((server, index) => {
          const isEditing = editingName === server.name && draft !== null;

          if (isEditing && draft) {
            return (
              <tr key={server.name + index}>
                <td>{server.name}</td>
                <td>
                  <select
                    value={draft.type}
                    onChange={e =>
                      setDraftType(e.target.value as 'stdio' | 'http')
                    }
                  >
                    <option value="stdio">{trans.__('stdio')}</option>
                    <option value="http">{trans.__('http')}</option>
                  </select>
                </td>
                <td>
                  {'command' in draft ? (
                    <input
                      value={(draft as IMcpServerStdio).command}
                      onChange={e =>
                        setDraft({
                          ...(draft as IMcpServerStdio),
                          command: e.target.value
                        })
                      }
                    />
                  ) : (
                    <input
                      value={(draft as IMcpServerHttp).url}
                      onChange={e =>
                        setDraft({
                          ...(draft as IMcpServerHttp),
                          url: e.target.value
                        })
                      }
                    />
                  )}
                </td>
                <td>
                  <Button onClick={saveEdit} title={trans.__('Save')}>
                    <checkIcon.react />
                  </Button>
                  <Button onClick={cancelEdit} title={trans.__('Cancel')}>
                    <closeIcon.react />
                  </Button>
                </td>
                <td>{trans.__('User config')}</td>
              </tr>
            );
          }

          return (
            <tr key={server.name + index}>
              <td>{server.name}</td>
              <td>{server.type || 'stdio'}</td>
              <td>{'command' in server ? server.command : server.url}</td>
              <td>
                {server.editable && (
                  <>
                    <Button
                      onClick={() => startEdit(server)}
                      title={trans.__('Edit')}
                    >
                      <editIcon.react />
                    </Button>
                    <Button
                      onClick={() => onDelete(server.name)}
                      title={trans.__('Delete')}
                    >
                      <deleteIcon.react />
                    </Button>
                  </>
                )}
              </td>
              <td>
                {server.editable
                  ? trans.__('User config')
                  : trans.__('System config')}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export const McpServersSettings: React.FC<IMcpServerPanelProps> = ({
  settings,
  serverSettings,
  translator
}) => {
  const trans = translator.load('jupyter-mcp-manager');
  const [servers, setServers] = useState<IMcpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      const data = await requestAPI<any>('servers', serverSettings);
      setServers(data.mcp_servers);
      setError(null);
    } catch (err) {
      setError(trans.__('Failed to load MCP servers'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (serverName: string) => {
    try {
      await requestAPI<any>(
        `servers?name=${encodeURIComponent(serverName)}`,
        serverSettings,
        { method: 'DELETE' }
      );
      await loadServers();
    } catch (err) {
      setError(trans.__('Failed to delete server'));
      console.error(err);
    }
  };

  const handleUpdate = async (server: IMcpServer) => {
    try {
      await requestAPI<any>('servers', serverSettings, {
        method: 'PUT',
        body: JSON.stringify(server),
        headers: { 'Content-Type': 'application/json' }
      });
      await loadServers();
    } catch (err) {
      setError(trans.__('Failed to update server'));
      console.error(err);
    }
  };

  if (loading) {
    return <div>{trans.__('Loading MCP servers...')}</div>;
  }

  if (error) {
    return <div className="jp-Alert jp-Alert-error">{error}</div>;
  }

  return (
    <ServerTable
      servers={servers}
      onDelete={handleDelete}
      onUpdate={handleUpdate}
      trans={trans}
    />
  );
};
