import { McpManager } from '../mcp-manager';
import { IMcpServerEntry, IMcpServer } from '../tokens';
import { requestAPI } from '../request';

jest.mock('../request', () => ({
  requestAPI: jest.fn()
}));

const mockRequestAPI = requestAPI as jest.MockedFunction<typeof requestAPI>;

describe('McpManager', () => {
  const mockServerSettings = { baseUrl: 'http://localhost:8888' } as any;

  const waitForSignal = (
    manager: McpManager,
    signal: 'serversChanged' | 'backendServersChanged'
  ): Promise<void> =>
    new Promise<void>(resolve => {
      manager[signal].connect(() => resolve());
    });

  beforeEach(() => {
    mockRequestAPI.mockRejectedValue(new Error('Backend unavailable'));
    jest.clearAllMocks();
  });

  const makeSettings = (mcp_servers: IMcpServer[]) => ({
    get: (key: string) =>
      key === 'mcpSettings' ? { composite: { mcp_servers } } : null,
    set: jest.fn().mockResolvedValue(undefined),
    changed: { connect: jest.fn(), disconnect: jest.fn() }
  });

  it('should load and return servers from settings', async () => {
    const rawServers: IMcpServer[] = [
      { name: 'test-http', type: 'http', url: 'http://localhost:8080' },
      { name: 'test-stdio', type: 'stdio', command: '/usr/bin/test' }
    ];

    const manager = new McpManager({
      serverSettings: mockServerSettings,
      settings: makeSettings(rawServers) as any
    });
    await waitForSignal(manager, 'serversChanged');

    const servers = manager.getMCPServers();
    expect(servers.length).toBe(2);
    expect(servers[0].name).toBe('test-http');
    expect(servers[0].source).toBe('settings');
    expect(servers[0].editable).toBe(true);
    expect(servers[1].name).toBe('test-stdio');
  });

  it('should get a specific server by name', async () => {
    const manager = new McpManager({
      serverSettings: mockServerSettings,
      settings: makeSettings([
        { name: 'server-1', type: 'stdio', command: '/usr/bin/server1' }
      ]) as any
    });
    await waitForSignal(manager, 'serversChanged');

    const server = manager.getMCPServer('server-1');
    expect(server).not.toBeNull();
    expect(server!.name).toBe('server-1');
    expect((server as any).command).toBe('/usr/bin/server1');
    expect(manager.getMCPServer('nonexistent')).toBeNull();
  });

  it('should sort servers by name', async () => {
    const manager = new McpManager({
      serverSettings: mockServerSettings,
      settings: makeSettings([
        { name: 'zebra', type: 'stdio', command: '/usr/bin/zebra' },
        { name: 'alpha', type: 'stdio', command: '/usr/bin/alpha' }
      ]) as any
    });
    await waitForSignal(manager, 'serversChanged');

    const servers = manager.getMCPServers();
    expect(servers[0].name).toBe('alpha');
    expect(servers[1].name).toBe('zebra');
  });

  it('should merge settings and backend servers', async () => {
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

    mockRequestAPI.mockResolvedValueOnce({ mcp_servers: backendServers });

    const manager = new McpManager({
      serverSettings: mockServerSettings,
      settings: makeSettings([
        { name: 'settings-server', type: 'stdio', command: '/usr/bin/settings' }
      ]) as any
    });
    await waitForSignal(manager, 'serversChanged');

    const servers = manager.getMCPServers();
    expect(servers.length).toBe(2);
    expect(servers.some(s => s.name === 'settings-server')).toBe(true);
    expect(servers.some(s => s.name === 'backend-server')).toBe(true);
  });

  it('should expose raw backend servers via getBackendMCPServers', async () => {
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

    mockRequestAPI.mockResolvedValueOnce({ mcp_servers: backendServers });

    const manager = new McpManager({
      serverSettings: mockServerSettings,
      settings: makeSettings([]) as any
    });
    await waitForSignal(manager, 'backendServersChanged');

    expect(manager.getBackendMCPServers().length).toBe(1);
    expect(manager.getBackendMCPServers()[0].name).toBe('backend-server');
  });

  it('should prioritize settings servers over backend servers with the same name', async () => {
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

    mockRequestAPI.mockResolvedValueOnce({ mcp_servers: backendServers });

    const manager = new McpManager({
      serverSettings: mockServerSettings,
      settings: makeSettings([
        {
          name: 'duplicate',
          type: 'stdio',
          command: '/usr/bin/settings-version'
        }
      ]) as any
    });
    await waitForSignal(manager, 'serversChanged');

    const servers = manager.getMCPServers();
    expect(servers.length).toBe(1);
    expect(servers[0].source).toBe('settings');
    expect((servers[0] as any).command).toBe('/usr/bin/settings-version');
  });

  it('should emit serversChanged when settings change', async () => {
    let mcpServers: IMcpServer[] = [
      { name: 'initial', type: 'stdio', command: '/usr/bin/initial' }
    ];

    const mockChangedSignal = {
      connect: jest.fn((cb: any, ctx: any) => {
        mockChangedSignal._callback = cb.bind(ctx);
      }),
      disconnect: jest.fn(),
      _callback: null as ((...args: any[]) => void) | null
    };

    const mockSettings = {
      get: (key: string) =>
        key === 'mcpSettings'
          ? { composite: { mcp_servers: mcpServers } }
          : null,
      set: jest.fn().mockResolvedValue(undefined),
      changed: mockChangedSignal
    };

    const manager = new McpManager({
      serverSettings: mockServerSettings,
      settings: mockSettings as any
    });
    await waitForSignal(manager, 'serversChanged');

    mcpServers = [
      ...mcpServers,
      { name: 'new-server', type: 'stdio', command: '/usr/bin/new' }
    ];

    const changedPromise = waitForSignal(manager, 'serversChanged');
    mockChangedSignal._callback?.();

    await changedPromise;
    expect(manager.getMCPServers().length).toBe(2);
    expect(manager.getMCPServers().some(s => s.name === 'new-server')).toBe(
      true
    );
  });

  it('should handle empty settings gracefully', async () => {
    const manager = new McpManager({
      serverSettings: mockServerSettings,
      settings: makeSettings([]) as any
    });
    await waitForSignal(manager, 'serversChanged');

    expect(manager.getMCPServers().length).toBe(0);
  });

  it('should work without settings (backend-only mode)', async () => {
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

    mockRequestAPI.mockResolvedValueOnce({ mcp_servers: backendServers });

    const manager = new McpManager({ serverSettings: mockServerSettings });
    await waitForSignal(manager, 'serversChanged');

    const servers = manager.getMCPServers();
    expect(servers.length).toBe(1);
    expect(servers[0].name).toBe('backend-server');
    expect(servers[0].source).toBe('backend');
  });
});
