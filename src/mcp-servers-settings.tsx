import React, { useState, useEffect } from 'react';
import { IThemeManager } from '@jupyterlab/apputils';
import { IRenderMime } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator } from '@jupyterlab/translation';

import Add from '@mui/icons-material/Add';
import Cable from '@mui/icons-material/Cable';
import Delete from '@mui/icons-material/Delete';
import Edit from '@mui/icons-material/Edit';
import MoreVert from '@mui/icons-material/MoreVert';
import Refresh from '@mui/icons-material/Refresh';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import {
  IEnvVariable,
  IHttpHeader,
  IMcpManager,
  IMcpServerEntry,
  IMcpServerHttp,
  IMcpServerSettings,
  IMcpServerStdio
} from './tokens';

const SWITCH_CLASS = 'jp-mcp-settings-switch';

interface IMcpServerPanelProps {
  manager: IMcpManager;
  settings: ISettingRegistry.ISettings;
  translator: ITranslator;
  themeManager?: IThemeManager;
}

/**
 * Create a theme that uses IThemeManager to detect theme
 * @param themeManager - Optional theme manager to detect theme
 * @returns A Material-UI theme configured for the current JupyterLab theme
 */
const createJupyterLabTheme = (themeManager?: IThemeManager) => {
  // Use IThemeManager if available, otherwise default to light theme
  const isDark = themeManager?.theme
    ? !themeManager.isLight(themeManager.theme)
    : false;
  return createTheme({ palette: { mode: isDark ? 'dark' : 'light' } });
};

interface IServerListProps {
  servers: IMcpServerEntry[];
  onDelete: (name: string) => void;
  onSave: (server: IMcpServerEntry) => void;
  onRefresh: () => void;
  onToggleDisabled: (server: IMcpServerEntry) => void;
  trans: IRenderMime.TranslationBundle;
}

interface IEditDialogProps {
  open: boolean;
  server: IMcpServerEntry | null; // null = add new
  onClose: () => void;
  onSave: (server: IMcpServerEntry) => void;
  trans: IRenderMime.TranslationBundle;
}

const EditServerDialog: React.FC<IEditDialogProps> = ({
  open,
  server,
  onClose,
  onSave,
  trans
}) => {
  const isNew = server === null;
  const isEditable = isNew || server.editable;

  const [name, setName] = useState('');
  const [type, setType] = useState<'stdio' | 'http'>('http');
  const [command, setCommand] = useState('');
  const [url, setUrl] = useState('');
  const [args, setArgs] = useState<string[]>([]);
  const [env, setEnv] = useState<IEnvVariable[]>([]);
  const [headers, setHeaders] = useState<IHttpHeader[]>([]);

  useEffect(() => {
    if (!open) return;
    const t = server?.type ?? 'http';
    const stdio = t === 'stdio' ? (server as IMcpServerStdio) : null;
    const http = t === 'http' ? (server as IMcpServerHttp) : null;
    setName(server?.name ?? '');
    setType(t);
    setCommand(stdio?.command ?? '');
    setUrl(http?.url ?? '');
    setArgs(stdio?.args ?? []);
    setEnv(stdio?.env ?? []);
    setHeaders(http?.headers ?? []);
  }, [open, server]);

  const handleTypeChange = (newType: 'stdio' | 'http') => {
    setType(newType);
    setCommand('');
    setUrl('');
    setArgs([]);
    setEnv([]);
    setHeaders([]);
  };

  const handleSave = () => {
    if (isNew && !name) return;
    const meta = {
      name: isNew ? name : server!.name,
      editable: server?.editable ?? true,
      deletable: server?.deletable ?? true,
      source: server?.source ?? ('settings' as const),
      config_file: server?.config_file ?? ''
    };
    const saved: IMcpServerEntry =
      type === 'stdio'
        ? { ...meta, type: 'stdio', command, args, env }
        : { ...meta, type: 'http', url, headers };
    onSave(saved);
    onClose();
  };

  const addArg = () => setArgs([...args, '']);
  const updateArg = (i: number, v: string) => {
    const next = [...args];
    next[i] = v;
    setArgs(next);
  };
  const removeArg = (i: number) => setArgs(args.filter((_, j) => j !== i));

  const addEnv = () => setEnv([...env, { name: '', value: '' }]);
  const updateEnv = (i: number, field: 'name' | 'value', v: string) => {
    const next = [...env];
    next[i] = { ...next[i], [field]: v };
    setEnv(next);
  };
  const removeEnv = (i: number) => setEnv(env.filter((_, j) => j !== i));

  const addHeader = () => setHeaders([...headers, { name: '', value: '' }]);
  const updateHeader = (i: number, field: 'name' | 'value', v: string) => {
    const next = [...headers];
    next[i] = { ...next[i], [field]: v };
    setHeaders(next);
  };
  const removeHeader = (i: number) =>
    setHeaders(headers.filter((_, j) => j !== i));

  const originLabel =
    server?.source === 'settings'
      ? trans.__('JupyterLab Settings')
      : isEditable
        ? trans.__('User config')
        : trans.__('System config');

  const title = isNew
    ? trans.__('Add Server')
    : isEditable
      ? trans.__('Edit Server')
      : trans.__('Server Details');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {isNew && (
            <TextField
              label={trans.__('Name')}
              value={name}
              onChange={e => setName(e.target.value)}
              size="small"
              fullWidth
              required
            />
          )}
          <TextField
            select
            label={trans.__('Type')}
            value={type}
            onChange={e => handleTypeChange(e.target.value as 'stdio' | 'http')}
            size="small"
            disabled={!isEditable}
          >
            <MenuItem value="stdio">{trans.__('stdio')}</MenuItem>
            <MenuItem value="http">{trans.__('http')}</MenuItem>
          </TextField>
          {type === 'stdio' ? (
            <TextField
              label={trans.__('Command')}
              value={command}
              onChange={e => setCommand(e.target.value)}
              size="small"
              fullWidth
              disabled={!isEditable}
            />
          ) : (
            <TextField
              label={trans.__('URL')}
              value={url}
              onChange={e => setUrl(e.target.value)}
              size="small"
              fullWidth
              disabled={!isEditable}
            />
          )}

          {/* Advanced: args / env vars / HTTP headers */}
          {type === 'stdio' && (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle2">
                  {trans.__('Arguments')}
                </Typography>
                {args.length === 0 && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic' }}
                  >
                    {trans.__('No arguments.')}
                  </Typography>
                )}
                {args.map((arg, i) => (
                  <Box
                    key={i}
                    sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
                  >
                    <TextField
                      value={arg}
                      disabled={!isEditable}
                      onChange={e => updateArg(i, e.target.value)}
                      size="small"
                      fullWidth
                    />
                    {isEditable && (
                      <IconButton
                        size="small"
                        onClick={() => removeArg(i)}
                        title={trans.__('Remove')}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                ))}
                {isEditable && (
                  <Button
                    size="small"
                    onClick={addArg}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {trans.__('Add')}
                  </Button>
                )}
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle2">
                  {trans.__('Environment Variables')}
                </Typography>
                {env.length === 0 && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic' }}
                  >
                    {trans.__('No environment variables.')}
                  </Typography>
                )}
                {env.map((envVar, i) => (
                  <Box
                    key={i}
                    sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
                  >
                    <TextField
                      value={envVar.name}
                      placeholder={trans.__('Name')}
                      disabled={!isEditable}
                      onChange={e => updateEnv(i, 'name', e.target.value)}
                      size="small"
                    />
                    <TextField
                      value={envVar.value}
                      placeholder={trans.__('Value')}
                      disabled={!isEditable}
                      onChange={e => updateEnv(i, 'value', e.target.value)}
                      size="small"
                    />
                    {isEditable && (
                      <IconButton
                        size="small"
                        onClick={() => removeEnv(i)}
                        title={trans.__('Remove')}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                ))}
                {isEditable && (
                  <Button
                    size="small"
                    onClick={addEnv}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {trans.__('Add')}
                  </Button>
                )}
              </Box>
            </>
          )}
          {type === 'http' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="subtitle2">
                {trans.__('HTTP Headers')}
              </Typography>
              {headers.length === 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontStyle: 'italic' }}
                >
                  {trans.__('No HTTP headers.')}
                </Typography>
              )}
              {headers.map((header, i) => (
                <Box
                  key={i}
                  sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
                >
                  <TextField
                    value={header.name}
                    placeholder={trans.__('Name')}
                    disabled={!isEditable}
                    onChange={e => updateHeader(i, 'name', e.target.value)}
                    size="small"
                  />
                  <TextField
                    value={header.value}
                    placeholder={trans.__('Value')}
                    disabled={!isEditable}
                    onChange={e => updateHeader(i, 'value', e.target.value)}
                    size="small"
                  />
                  {isEditable && (
                    <IconButton
                      size="small"
                      onClick={() => removeHeader(i)}
                      title={trans.__('Remove')}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))}
              {isEditable && (
                <Button
                  size="small"
                  onClick={addHeader}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {trans.__('Add')}
                </Button>
              )}
            </Box>
          )}

          {/* Config file (existing servers only) */}
          {!isNew && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="subtitle2">
                {trans.__('Config file')}
              </Typography>
              <Typography variant="body2">{originLabel}</Typography>
              {server.config_file && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                >
                  {server.config_file}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{trans.__('Cancel')}</Button>
        {isEditable && (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={isNew && !name}
          >
            {trans.__('Save')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

const McpServerList: React.FC<IServerListProps> = ({
  servers,
  onDelete,
  onSave,
  onRefresh,
  onToggleDisabled,
  trans
}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuServer, setMenuServer] = useState<IMcpServerEntry | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editServer, setEditServer] = useState<IMcpServerEntry | null>(null);

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    server: IMcpServerEntry
  ) => {
    setMenuAnchor(event.currentTarget);
    setMenuServer(server);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuServer(null);
  };

  const handleOpenDialog = (server: IMcpServerEntry | null) => {
    setEditServer(server);
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleDelete = () => {
    if (menuServer) onDelete(menuServer.name);
    handleMenuClose();
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setEditServer(null);
  };

  const handleEditSave = (server: IMcpServerEntry) => {
    onSave(server);
    handleEditClose();
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Cable color="primary" />
          <Typography variant="h6" component="h2">
            {trans.__('MCP Servers')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={onRefresh}
            size="small"
            title={trans.__('Refresh server list')}
          >
            <Refresh />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog(null)}
            size="small"
          >
            {trans.__('Add Server')}
          </Button>
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {trans.__(
          "Configure MCP servers to extend JupyterLab's capabilities with external tools and data sources."
        )}
      </Typography>

      {servers.length === 0 ? (
        <Alert severity="info">
          {trans.__(
            'No MCP servers configured. Click "Add Server" to get started.'
          )}
        </Alert>
      ) : (
        <List disablePadding>
          {servers.map(server => {
            const sourceLabel =
              server.source === 'settings'
                ? trans.__('Settings')
                : server.editable
                  ? trans.__('User config')
                  : trans.__('System config');

            return (
              <ListItem
                key={server.name}
                divider
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={e => handleMenuOpen(e, server)}
                    title={trans.__('Actions')}
                  >
                    <MoreVert />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body1"
                        sx={{ opacity: server.disabled ? 0.5 : 1 }}
                      >
                        {server.name}
                      </Typography>
                      <Switch
                        className={SWITCH_CLASS}
                        checked={!server.disabled}
                        onClick={e => {
                          e.stopPropagation();
                          onToggleDisabled(server);
                        }}
                        size="small"
                        color="primary"
                        readOnly
                      />
                    </Box>
                  }
                  secondary={
                    <Box
                      component="span"
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                        opacity: server.disabled ? 0.5 : 1
                      }}
                    >
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontFamily: 'monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block'
                        }}
                      >
                        {server.type === 'stdio'
                          ? (server as IMcpServerStdio & IMcpServerEntry)
                              .command
                          : (server as IMcpServerHttp & IMcpServerEntry).url}
                      </Typography>
                      <Box component="span" sx={{ display: 'flex', gap: 0.5 }}>
                        <Chip
                          label={server.type || 'stdio'}
                          size="small"
                          color={server.type === 'http' ? 'warning' : 'primary'}
                          variant="outlined"
                        />
                        <Chip
                          label={sourceLabel}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      )}

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleOpenDialog(menuServer)}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          {menuServer?.editable ? trans.__('Edit') : trans.__('View details')}
        </MenuItem>
        {menuServer?.deletable && (
          <MenuItem onClick={handleDelete}>
            <Delete fontSize="small" sx={{ mr: 1 }} />
            {trans.__('Delete')}
          </MenuItem>
        )}
      </Menu>

      <EditServerDialog
        open={editDialogOpen}
        server={editServer}
        onClose={handleEditClose}
        onSave={handleEditSave}
        trans={trans}
      />
    </Box>
  );
};

export const McpServersSettings: React.FC<IMcpServerPanelProps> = ({
  manager,
  settings,
  translator,
  themeManager
}) => {
  const trans = translator.load('jupyter-mcp-manager');
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState(() => createJupyterLabTheme(themeManager));

  useEffect(() => {
    if (!themeManager) return;
    const updateTheme = () => setTheme(createJupyterLabTheme(themeManager));
    themeManager.themeChanged.connect(updateTheme);
    return () => {
      themeManager.themeChanged.disconnect(updateTheme);
    };
  }, [themeManager]);

  const [settingsMCP, setSettingsMCP] = useState<IMcpServerEntry[]>(
    () => Private.parseSettingsMCP(settings).servers
  );
  const [overlayMap, setOverlayMap] = useState<Map<string, boolean>>(
    () => Private.parseSettingsMCP(settings).overlayMap
  );

  const [backendMCP, setBackendMCP] = useState<IMcpServerEntry[]>(
    manager.getBackendMCPServers()
  );

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

  const settingsNames = new Set(settingsMCP.map(s => s.name));
  const servers: IMcpServerEntry[] = [
    ...settingsMCP,
    ...backendMCP
      .filter(s => !settingsNames.has(s.name))
      .map(s =>
        overlayMap.has(s.name) ? { ...s, disabled: overlayMap.get(s.name) } : s
      )
  ].sort((a, b) => (a.name < b.name ? -1 : 1));

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

  const handleToggleDisabled = async (entry: IMcpServerEntry) => {
    const newDisabled = !entry.disabled;
    try {
      const list = Private.getSettingsList(settings);
      if (entry.source === 'settings') {
        await Private.writeSettingsList(
          settings,
          list.map(s =>
            s.name === entry.name && 'type' in s
              ? { ...s, disabled: newDisabled ? true : undefined }
              : s
          )
        );
      } else {
        const rest = list.filter(
          s => !(s.name === entry.name && !('type' in s))
        );
        if (newDisabled) {
          await Private.writeSettingsList(settings, [
            ...rest,
            { name: entry.name, disabled: true }
          ]);
        } else {
          // When enabling, check whether the backend server is natively disabled.
          // If so, write an explicit enabled overlay; otherwise just remove any overlay.
          const nativeDisabled =
            backendMCP.find(s => s.name === entry.name)?.disabled ?? false;
          if (nativeDisabled) {
            await Private.writeSettingsList(settings, [
              ...rest,
              { name: entry.name, disabled: false }
            ]);
          } else {
            await Private.writeSettingsList(settings, rest);
          }
        }
      }
    } catch {
      setError(trans.__('Failed to toggle server'));
    }
  };

  const handleRefresh = async () => {
    try {
      await manager.refresh();
    } catch {
      setError(trans.__('Failed to refresh servers'));
    }
  };

  return (
    <ThemeProvider theme={theme}>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <McpServerList
          servers={servers}
          onDelete={handleDelete}
          onSave={handleSave}
          onRefresh={handleRefresh}
          onToggleDisabled={handleToggleDisabled}
          trans={trans}
        />
      )}
    </ThemeProvider>
  );
};

namespace Private {
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

  export const getSettingsList = (
    settings: ISettingRegistry.ISettings
  ): IMcpServerSettings[] => {
    const current = settings.get('mcpSettings').composite as {
      mcp_servers?: IMcpServerSettings[];
    } | null;
    return current?.mcp_servers ?? [];
  };

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
