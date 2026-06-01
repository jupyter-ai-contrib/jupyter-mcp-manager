/**
 * Unit tests for the McpManager class with settings
 */

import { McpManager } from '../mcp-manager';
import { IMcpServerEntry, IMcpServer } from '../tokens';
import { requestAPI } from '../request';

// Mock requestAPI to avoid real HTTP calls
jest.mock('../request', () => ({
  requestAPI: jest.fn()
}));

const mockRequestAPI = requestAPI as jest.MockedFunction<typeof requestAPI>;

describe('McpManager with settings', () => {
  const mockServerSettings = { baseUrl: 'http://localhost:8888' };

  // Helper to wait for serversChanged signal
  const waitForServersChanged = (manager: McpManager): Promise<void> => {
    return new Promise<void>(resolve => {
      manager.serversChanged.connect(() => {
        resolve();
      });
    });
  };

  beforeEach(() => {
    // Reset mock before each test
    mockRequestAPI.mockRejectedValue(new Error('Backend unavailable'));
    jest.clearAllMocks();
  });

  it('should load and return servers from settings', async () => {
    const rawServers: IMcpServer[] = [
      {
        name: 'test-http',
        type: 'http',
        url: 'http://localhost:8080'
      },
      {
        name: 'test-stdio',
        type: 'stdio',
        command: '/usr/bin/test'
      }
    ];

    const mockSettings = {
      get: (key: string) => {
        if (key === 'mcpSettings') {
          return { composite: { mcp_servers: rawServers } };
        }
        return null;
      },
      set: jest.fn().mockResolvedValue(undefined),
      changed: { connect: jest.fn(), disconnect: jest.fn() }
    };

    const mockSettingRegistry = {
      load: jest.fn().mockResolvedValue(mockSettings)
    };

    const manager = new McpManager(
      mockServerSettings,
      mockSettingRegistry as any
    );
    await waitForServersChanged(manager);

    const servers = manager.getServers();
    expect(servers.length).toBe(2);
    expect(servers[0].name).toBe('test-http');
    expect(servers[0].type).toBe('http');
    expect(servers[0].source).toBe('settings');
    expect(servers[0].editable).toBe(true);
    expect(servers[1].name).toBe('test-stdio');
    expect(servers[1].type).toBe('stdio');
  });

  it('should get a specific server by name from settings', async () => {
    const rawServers: IMcpServer[] = [
      {
        name: 'server-1',
        type: 'stdio',
        command: '/usr/bin/server1'
      }
    ];

    const mockSettings = {
      get: (key: string) => {
        if (key === 'mcpSettings') {
          return { composite: { mcp_servers: rawServers } };
        }
        return null;
      },
      set: jest.fn().mockResolvedValue(undefined),
      changed: { connect: jest.fn(), disconnect: jest.fn() }
    };

    const mockSettingRegistry = {
      load: jest.fn().mockResolvedValue(mockSettings)
    };

    const manager = new McpManager(
      mockServerSettings,
      mockSettingRegistry as any
    );
    await waitForServersChanged(manager);

    const server = manager.getServer('server-1');
    expect(server).not.toBeNull();
    expect(server!.name).toBe('server-1');
    expect(server!.type).toBe('stdio');
    expect((server as any).command).toBe('/usr/bin/server1');
  });

  it('should return null for non-existent server', async () => {
    const mockSettings = {
      get: (key: string) => {
        if (key === 'mcpSettings') {
          return { composite: { mcp_servers: [] } };
        }
        return null;
      },
      set: jest.fn().mockResolvedValue(undefined),
      changed: { connect: jest.fn(), disconnect: jest.fn() }
    };

    const mockSettingRegistry = {
      load: jest.fn().mockResolvedValue(mockSettings)
    };

    const manager = new McpManager(
      mockServerSettings,
      mockSettingRegistry as any
    );
    await waitForServersChanged(manager);

    expect(manager.getServer('nonexistent')).toBeNull();
  });

  it('should save a new server to settings', async () => {
    const mockSettings = {
      get: (key: string) => {
        if (key === 'mcpSettings') {
          return { composite: { mcp_servers: [] } };
        }
        return null;
      },
      set: jest.fn().mockResolvedValue(undefined),
      changed: { connect: jest.fn(), disconnect: jest.fn() }
    };

    const mockSettingRegistry = {
      load: jest.fn().mockResolvedValue(mockSettings)
    };

    const manager = new McpManager(
      mockServerSettings,
      mockSettingRegistry as any
    );
    await waitForServersChanged(manager);

    const newServer: IMcpServerEntry = {
      name: 'new-server',
      type: 'stdio',
      command: '/usr/bin/new',
      editable: true,
      deletable: true,
      source: 'settings',
      config_file: ''
    };

    await manager.saveServer(newServer);

    expect(mockSettings.set).toHaveBeenCalledWith('mcpSettings', {
      mcp_servers: [
        { name: 'new-server', type: 'stdio', command: '/usr/bin/new' }
      ]
    });
  });

  it('should update an existing server in settings', async () => {
    const rawServers: IMcpServer[] = [
      {
        name: 'existing',
        type: 'stdio',
        command: '/usr/bin/old'
      }
    ];

    const mockSettings = {
      get: (key: string) => {
        if (key === 'mcpSettings') {
          return { composite: { mcp_servers: rawServers } };
        }
        return null;
      },
      set: jest.fn().mockResolvedValue(undefined),
      changed: { connect: jest.fn(), disconnect: jest.fn() }
    };

    const mockSettingRegistry = {
      load: jest.fn().mockResolvedValue(mockSettings)
    };

    const manager = new McpManager(
      mockServerSettings,
      mockSettingRegistry as any
    );
    await waitForServersChanged(manager);

    const updatedServer: IMcpServerEntry = {
      name: 'existing',
      type: 'stdio',
      command: '/usr/bin/new',
      editable: true,
      deletable: true,
      source: 'settings',
      config_file: ''
    };

    await manager.saveServer(updatedServer);

    expect(mockSettings.set).toHaveBeenCalledWith('mcpSettings', {
      mcp_servers: [
        { name: 'existing', type: 'stdio', command: '/usr/bin/new' }
      ]
    });
  });

  it('should delete a server from settings', async () => {
    const rawServers: IMcpServer[] = [
      {
        name: 'to-delete',
        type: 'stdio',
        command: '/usr/bin/del'
      },
      {
        name: 'to-keep',
        type: 'stdio',
        command: '/usr/bin/keep'
      }
    ];

    const mockSettings = {
      get: (key: string) => {
        if (key === 'mcpSettings') {
          return { composite: { mcp_servers: rawServers } };
        }
        return null;
      },
      set: jest.fn().mockResolvedValue(undefined),
      changed: { connect: jest.fn(), disconnect: jest.fn() }
    };

    const mockSettingRegistry = {
      load: jest.fn().mockResolvedValue(mockSettings)
    };

    const manager = new McpManager(
      mockServerSettings,
      mockSettingRegistry as any
    );
    await waitForServersChanged(manager);

    await manager.deleteServer('to-delete');

    expect(mockSettings.set).toHaveBeenCalledWith('mcpSettings', {
      mcp_servers: [
        { name: 'to-keep', type: 'stdio', command: '/usr/bin/keep' }
      ]
    });
  });

  it('should not delete backend servers', async () => {
    const mockSettings = {
      get: (key: string) => {
        if (key === 'mcpSettings') {
          return { composite: { mcp_servers: [] } };
        }
        return null;
      },
      set: jest.fn().mockResolvedValue(undefined),
      changed: { connect: jest.fn(), disconnect: jest.fn() }
    };

    const mockSettingRegistry = {
      load: jest.fn().mockResolvedValue(mockSettings)
    };

    const manager = new McpManager(
      mockServerSettings,
      mockSettingRegistry as any
    );
    await waitForServersChanged(manager);

    (manager as any)._servers = [
      {
        name: 'backend-server',
        type: 'stdio',
        command: '/usr/bin/backend',
        editable: false,
        deletable: false,
        source: 'backend',
        config_file: '/etc/config.json'
      }
    ];

    await manager.deleteServer('backend-server');

    expect(mockSettings.set).not.toHaveBeenCalled();
  });

  it('should sort servers by name', async () => {
    const rawServers: IMcpServer[] = [
      {
        name: 'zebra',
        type: 'stdio',
        command: '/usr/bin/zebra'
      },
      {
        name: 'alpha',
        type: 'stdio',
        command: '/usr/bin/alpha'
      }
    ];

    const mockSettings = {
      get: (key: string) => {
        if (key === 'mcpSettings') {
          return { composite: { mcp_servers: rawServers } };
        }
        return null;
      },
      set: jest.fn().mockResolvedValue(undefined),
      changed: { connect: jest.fn(), disconnect: jest.fn() }
    };

    const mockSettingRegistry = {
      load: jest.fn().mockResolvedValue(mockSettings)
    };

    const manager = new McpManager(
      mockServerSettings,
      mockSettingRegistry as any
    );
    await waitForServersChanged(manager);

    const servers = manager.getServers();
    expect(servers.length).toBe(2);
    expect(servers[0].name).toBe('alpha');
    expect(servers[1].name).toBe('zebra');
  });

  it('should merge settings and backend servers', async () => {
    const settingsServers: IMcpServer[] = [
      {
        name: 'settings-server',
        type: 'stdio',
        command: '/usr/bin/settings'
      }
    ];

    const backendServers: IMcpServerEntry[] = [
      {
        name: 'backend-server',
        type: 'stdio',
        command: '/usr/bin/backend',
        editable: false,
        deletable: false,
        source: 'backend',
        config_file: '/etc/config.json'
      }
    ];

    const mockSettings = {
      get: (key: string) => {
        if (key === 'mcpSettings') {
          return { composite: { mcp_servers: settingsServers } };
        }
        return null;
      },
      set: jest.fn().mockResolvedValue(undefined),
      changed: { connect: jest.fn(), disconnect: jest.fn() }
    };

    const mockSettingRegistry = {
      load: jest.fn().mockResolvedValue(mockSettings)
    };

    // Mock requestAPI to return backend servers
    mockRequestAPI.mockResolvedValueOnce({ mcp_servers: backendServers });

    const manager = new McpManager(
      mockServerSettings,
      mockSettingRegistry as any
    );
    await waitForServersChanged(manager);

    const servers = manager.getServers();
    expect(servers.length).toBe(2);
    expect(servers.some(s => s.name === 'settings-server')).toBe(true);
    expect(servers.some(s => s.name === 'backend-server')).toBe(true);
  });

  it('should prioritize settings servers over backend servers with same name', async () => {
    const settingsServers: IMcpServer[] = [
      {
        name: 'duplicate',
        type: 'stdio',
        command: '/usr/bin/settings-version'
      }
    ];

    const backendServers: IMcpServerEntry[] = [
      {
        name: 'duplicate',
        type: 'stdio',
        command: '/usr/bin/backend-version',
        editable: false,
        deletable: false,
        source: 'backend',
        config_file: '/etc/config.json'
      }
    ];

    const mockSettings = {
      get: (key: string) => {
        if (key === 'mcpSettings') {
          return { composite: { mcp_servers: settingsServers } };
        }
        return null;
      },
      set: jest.fn().mockResolvedValue(undefined),
      changed: { connect: jest.fn(), disconnect: jest.fn() }
    };

    const mockSettingRegistry = {
      load: jest.fn().mockResolvedValue(mockSettings)
    };

    // Mock requestAPI to return backend servers with duplicate
    mockRequestAPI.mockResolvedValueOnce({ mcp_servers: backendServers });

    const manager = new McpManager(
      mockServerSettings,
      mockSettingRegistry as any
    );
    await waitForServersChanged(manager);

    const servers = manager.getServers();
    expect(servers.length).toBe(1);
    expect(servers[0].name).toBe('duplicate');
    expect(servers[0].source).toBe('settings');
    expect((servers[0] as any).command).toBe('/usr/bin/settings-version');
  });

  it('should handle empty settings gracefully', async () => {
    const mockSettings = {
      get: (key: string) => {
        if (key === 'mcpSettings') {
          return { composite: { mcp_servers: [] } };
        }
        return null;
      },
      set: jest.fn().mockResolvedValue(undefined),
      changed: { connect: jest.fn(), disconnect: jest.fn() }
    };

    const mockSettingRegistry = {
      load: jest.fn().mockResolvedValue(mockSettings)
    };

    const manager = new McpManager(
      mockServerSettings,
      mockSettingRegistry as any
    );
    await waitForServersChanged(manager);

    const servers = manager.getServers();
    expect(servers.length).toBe(0);
  });

  it('should emit serversChanged signal when settings change', async () => {
    const rawServers: IMcpServer[] = [
      {
        name: 'initial',
        type: 'stdio',
        command: '/usr/bin/initial'
      }
    ];

    let mcpServers = [...rawServers];

    // Create a mock signal for settings.changed
    const mockChangedSignal = {
      connect: jest.fn((callback: any, context: any) => {
        // When connected, store the callback to call later
        mockChangedSignal._callback = callback.bind(context);
      }),
      disconnect: jest.fn(),
      _callback: null as ((...args: any[]) => void) | null
    };

    const mockSettings = {
      get: (key: string) => {
        if (key === 'mcpSettings') {
          return { composite: { mcp_servers: mcpServers } };
        }
        return null;
      },
      set: jest.fn().mockResolvedValue(undefined),
      changed: mockChangedSignal
    };

    const mockSettingRegistry = {
      load: jest.fn().mockResolvedValue(mockSettings)
    };

    const manager = new McpManager(
      mockServerSettings,
      mockSettingRegistry as any
    );
    await waitForServersChanged(manager);

    // Add a new server to the settings
    mcpServers.push({
      name: 'new-server',
      type: 'stdio',
      command: '/usr/bin/new'
    });

    // Set up listener for the change
    const changedPromise = new Promise<void>(resolve => {
      manager.serversChanged.connect(() => {
        resolve();
      });
    });

    // Trigger a settings change by calling the stored callback
    if (mockChangedSignal._callback) {
      mockChangedSignal._callback();
    }

    await changedPromise;
    expect(manager.getServers().length).toBe(2);
    expect(manager.getServers().some(s => s.name === 'new-server')).toBe(true);
  });
});
