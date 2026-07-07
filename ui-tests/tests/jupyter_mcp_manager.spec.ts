import { expect, test } from '@jupyterlab/galata';

const API_PATH = '/jupyter-mcp-manager/servers';

const STDIO_SERVER = {
  name: 'test-stdio',
  type: 'stdio',
  command: '/usr/bin/test-server',
  args: ['--verbose', '--port', '8080'],
  env: [{ name: 'DEBUG', value: 'true' }]
};

const HTTP_SERVER = {
  name: 'test-http',
  type: 'http',
  url: 'http://localhost:3000/mcp',
  headers: [{ name: 'Authorization', value: 'Bearer token' }]
};

async function openMcpSettings(page: any) {
  await page.menu.clickMenuItem('Settings>Settings Editor');
  await page.getByText('MCP Servers').first().click();
  await page.getByRole('button', { name: 'Add Server' }).waitFor();
}

async function openActionsMenu(page: any, serverName: string) {
  const item = page.getByRole('listitem').filter({ hasText: serverName });
  await expect(item).toBeVisible();
  await item.getByTitle('Actions').click();
}

async function openEditDialog(page: any, serverName: string) {
  await openActionsMenu(page, serverName);
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await page.getByRole('dialog').waitFor();
}

async function addServerViaApi(page: any, server: object) {
  const result = await page.evaluate(
    async ([path, data]: [string, object]) => {
      const response = await fetch(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return {
        ok: response.ok,
        status: response.status,
        body: await response.text()
      };
    },
    [API_PATH, server] as [string, object]
  );
  if (!result.ok) {
    throw new Error(`addServerViaApi failed: ${result.status} ${result.body}`);
  }
}

async function deleteServerViaApi(page: any, name: string) {
  const result = await page.evaluate(
    async ([path, name]: [string, string]) => {
      const response = await fetch(`${path}?name=${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      return {
        ok: response.ok,
        status: response.status,
        body: await response.text()
      };
    },
    [API_PATH, name] as [string, string]
  );
  if (!result.ok) {
    throw new Error(
      `deleteServerViaApi failed: ${result.status} ${result.body}`
    );
  }
}

test.describe('activation', () => {
  test.use({ autoGoto: false });

  test('should emit an activation console message', async ({ page }) => {
    const logs: string[] = [];

    page.on('console', message => {
      logs.push(message.text());
    });

    await page.goto();

    expect(
      logs.filter(
        s => s === 'JupyterLab extension jupyter-mcp-manager is activated!'
      )
    ).toHaveLength(1);
  });
});

test.describe('MCP Servers Settings panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.sidebar.close('left');
  });

  test('should open the MCP servers settings panel', async ({ page }) => {
    await openMcpSettings(page);
    await expect(
      page.getByRole('heading', {
        name: 'MCP Servers',
        description: 'Configure MCP servers'
      })
    ).toBeVisible();
  });

  test('should show empty state when no servers are configured', async ({
    page
  }) => {
    await openMcpSettings(page);
    await expect(page.getByText('No MCP servers configured')).toBeVisible();
  });

  test('should show an Add Server button', async ({ page }) => {
    await openMcpSettings(page);
    await expect(
      page.getByRole('button', { name: 'Add Server' })
    ).toBeVisible();
  });

  test.describe('server list', () => {
    test.beforeEach(async ({ page }) => {
      await addServerViaApi(page, STDIO_SERVER);
      await addServerViaApi(page, HTTP_SERVER);
    });

    test.afterEach(async ({ page }) => {
      await deleteServerViaApi(page, STDIO_SERVER.name);
      await deleteServerViaApi(page, HTTP_SERVER.name);
    });

    test('should display stdio server with command', async ({ page }) => {
      await openMcpSettings(page);
      await page.pause();
      const item = page
        .getByRole('listitem')
        .filter({ hasText: STDIO_SERVER.name });
      await expect(item).toBeVisible();
      await expect(item).toContainText('stdio');
      await expect(item).toContainText(STDIO_SERVER.command);
    });

    test('should display http server with url', async ({ page }) => {
      await openMcpSettings(page);
      const item = page
        .getByRole('listitem')
        .filter({ hasText: HTTP_SERVER.name });
      await expect(item).toBeVisible();
      await expect(item).toContainText('http');
      await expect(item).toContainText(HTTP_SERVER.url);
    });

    test('should show an actions menu button for each server', async ({
      page
    }) => {
      await openMcpSettings(page);
      for (const name of [STDIO_SERVER.name, HTTP_SERVER.name]) {
        const item = page.getByRole('listitem').filter({ hasText: name });
        await expect(item).toBeVisible();
        await expect(item.getByTitle('Actions')).toBeVisible();
      }
    });

    test('should show Edit option in actions menu for backend server', async ({
      page
    }) => {
      await openMcpSettings(page);
      await openActionsMenu(page, STDIO_SERVER.name);
      await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: 'Delete' })
      ).not.toBeVisible();
    });

    test('should show Edit and Delete options for a settings server', async ({
      page
    }) => {
      const name = 'test-settings-server';
      await openMcpSettings(page);

      // Add a server via the UI (source: settings)
      await page.getByRole('button', { name: 'Add Server' }).click();
      await page.getByRole('dialog').waitFor();
      await page.getByLabel('Name').fill(name);
      await page.getByLabel('URL').fill('http://localhost:9000/mcp');
      await page.getByRole('button', { name: 'Save' }).click();

      await expect(
        page.getByRole('listitem').filter({ hasText: name })
      ).toBeVisible();

      // Settings servers expose Delete
      await openActionsMenu(page, name);
      await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
      await expect(
        page.getByRole('menuitem', { name: 'Delete' })
      ).toBeVisible();

      // Clean up: delete via menu
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await expect(
        page.getByRole('listitem').filter({ hasText: name })
      ).not.toBeVisible();
    });
  });
});

test.describe('Edit server dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.sidebar.close('left');
  });

  test.describe('stdio server', () => {
    test.beforeEach(async ({ page }) => {
      await addServerViaApi(page, STDIO_SERVER);
      await openMcpSettings(page);
      await openEditDialog(page, STDIO_SERVER.name);
    });

    test.afterEach(async ({ page }) => {
      await deleteServerViaApi(page, STDIO_SERVER.name);
    });

    test('should open the edit dialog', async ({ page }) => {
      await expect(page.getByRole('dialog')).toContainText('Edit Server');
    });

    test('should show Arguments and Environment Variables sections', async ({
      page
    }) => {
      await expect(page.getByRole('dialog')).toContainText('Arguments');
      await expect(page.getByRole('dialog')).toContainText(
        'Environment Variables'
      );
    });

    test('should not show HTTP Headers section', async ({ page }) => {
      await expect(page.getByRole('dialog')).not.toContainText('HTTP Headers');
    });

    test('should show Config file with User config', async ({ page }) => {
      await expect(page.getByRole('dialog')).toContainText('Config file');
      await expect(page.getByRole('dialog')).toContainText('User config');
    });

    test('should close on Cancel', async ({ page }) => {
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('http server', () => {
    test.beforeEach(async ({ page }) => {
      await addServerViaApi(page, HTTP_SERVER);
      await openMcpSettings(page);
      await openEditDialog(page, HTTP_SERVER.name);
    });

    test.afterEach(async ({ page }) => {
      await deleteServerViaApi(page, HTTP_SERVER.name);
    });

    test('should show HTTP Headers section', async ({ page }) => {
      await expect(page.getByRole('dialog')).toContainText('HTTP Headers');
    });

    test('should not show Arguments or Environment Variables sections', async ({
      page
    }) => {
      await expect(page.getByRole('dialog')).not.toContainText('Arguments');
      await expect(page.getByRole('dialog')).not.toContainText(
        'Environment Variables'
      );
    });

    test('should show Save button', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    });
  });
});
