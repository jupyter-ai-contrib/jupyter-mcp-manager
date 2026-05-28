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
  await page.locator('.jp-mcp-table').waitFor();
}

async function addServerViaApi(page: any, server: object) {
  await page.request.put(API_PATH, {
    headers: { 'Content-Type': 'application/json' },
    data: server
  });
}

async function deleteServerViaApi(page: any, name: string) {
  await page.request.delete(`${API_PATH}?name=${encodeURIComponent(name)}`);
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
    await expect(page.locator('.jp-mcp-table')).toBeVisible();
  });

  test('should show table headers', async ({ page }) => {
    await openMcpSettings(page);
    const table = page.locator('.jp-mcp-table');
    await expect(
      table.getByRole('columnheader', { name: 'Name' })
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: 'Type' })
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: 'Command/URL' })
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: 'Actions' })
    ).toBeVisible();
  });

  test('should show empty state when no servers are configured', async ({
    page
  }) => {
    await openMcpSettings(page);
    await expect(page.locator('.jp-mcp-empty')).toContainText(
      'No servers configured.'
    );
  });

  test('should show an Add button', async ({ page }) => {
    await openMcpSettings(page);
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  });

  test.describe('server rows', () => {
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
      const row = page.locator('tr', { hasText: STDIO_SERVER.name });
      await expect(row).toContainText('stdio');
      await expect(row).toContainText(STDIO_SERVER.command);
    });

    test('should display http server with url', async ({ page }) => {
      await openMcpSettings(page);
      const row = page.locator('tr', { hasText: HTTP_SERVER.name });
      await expect(row).toContainText('http');
      await expect(row).toContainText(HTTP_SERVER.url);
    });

    test('should show edit button for editable servers', async ({
      page
    }) => {
      await openMcpSettings(page);
      const row = page.locator('tr', { hasText: STDIO_SERVER.name });
      await expect(row.getByTitle('Edit')).toBeVisible();
    });

    test('should show advanced settings button for all servers', async ({
      page
    }) => {
      await openMcpSettings(page);
      for (const name of [STDIO_SERVER.name, HTTP_SERVER.name]) {
        await expect(
          page.locator('tr', { hasText: name }).getByTitle('Advanced settings')
        ).toBeVisible();
      }
    });
  });
});

test.describe('Advanced settings popup', () => {
  test.beforeEach(async ({ page }) => {
    await page.sidebar.close('left');
  });

  test.describe('stdio server', () => {
    test.beforeEach(async ({ page }) => {
      await addServerViaApi(page, STDIO_SERVER);
      await openMcpSettings(page);
      await page
        .locator('tr', { hasText: STDIO_SERVER.name })
        .getByTitle('Advanced settings')
        .click();
      await page.locator('.jp-mcp-popup').waitFor();
    });

    test.afterEach(async ({ page }) => {
      await deleteServerViaApi(page, STDIO_SERVER.name);
    });

    test('should open the popup with server name in header', async ({
      page
    }) => {
      await expect(page.locator('.jp-mcp-popup-header')).toContainText(
        STDIO_SERVER.name
      );
    });

    test('should show Arguments and Environment Variables sections', async ({
      page
    }) => {
      await expect(page.locator('.jp-mcp-popup')).toContainText('Arguments');
      await expect(page.locator('.jp-mcp-popup')).toContainText(
        'Environment Variables'
      );
    });

    test('should not show HTTP Headers section', async ({ page }) => {
      await expect(page.locator('.jp-mcp-popup')).not.toContainText(
        'HTTP Headers'
      );
    });

    test('should display existing args', async ({ page }) => {
      for (let i = 0; i < STDIO_SERVER.args.length; i++) {
        await expect(page.locator('.jp-mcp-arg-row input').nth(i)).toHaveValue(
          STDIO_SERVER.args[i]
        );
      }
    });

    test('should show Config file with User config', async ({ page }) => {
      await expect(page.locator('.jp-mcp-popup')).toContainText('Config file');
      await expect(page.locator('.jp-mcp-popup')).toContainText('User config');
    });

    test('should close on Cancel', async ({ page }) => {
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('.jp-mcp-popup')).not.toBeVisible();
    });

    test('should close when clicking the overlay', async ({ page }) => {
      await page
        .locator('.jp-mcp-popup-overlay')
        .click({ position: { x: 5, y: 5 } });
      await expect(page.locator('.jp-mcp-popup')).not.toBeVisible();
    });

    test('should add a new argument and save', async ({ page }) => {
      const initialCount = await page.locator('.jp-mcp-arg-row').count();

      await page
        .locator('.jp-mcp-popup')
        .getByRole('button', { name: 'Add' })
        .first()
        .click();
      await expect(page.locator('.jp-mcp-arg-row')).toHaveCount(
        initialCount + 1
      );
      await page.locator('.jp-mcp-arg-row input').last().fill('--new-arg');

      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('.jp-mcp-popup')).not.toBeVisible();

      // Reopen and verify the arg was persisted
      await page
        .locator('tr', { hasText: STDIO_SERVER.name })
        .getByTitle('Advanced settings')
        .click();
      await expect(page.locator('.jp-mcp-arg-row input').last()).toHaveValue(
        '--new-arg'
      );
    });
  });

  test.describe('http server', () => {
    test.beforeEach(async ({ page }) => {
      await addServerViaApi(page, HTTP_SERVER);
      await openMcpSettings(page);
      await page
        .locator('tr', { hasText: HTTP_SERVER.name })
        .getByTitle('Advanced settings')
        .click();
      await page.locator('.jp-mcp-popup').waitFor();
    });

    test.afterEach(async ({ page }) => {
      await deleteServerViaApi(page, HTTP_SERVER.name);
    });

    test('should show HTTP Headers section with existing headers', async ({
      page
    }) => {
      await expect(page.locator('.jp-mcp-popup')).toContainText('HTTP Headers');
      await expect(
        page.locator('.jp-mcp-popup .jp-mcp-kv-row input').first()
      ).toHaveValue(HTTP_SERVER.headers[0].name);
    });

    test('should not show Arguments or Environment Variables sections', async ({
      page
    }) => {
      await expect(page.locator('.jp-mcp-popup')).not.toContainText(
        'Arguments'
      );
      await expect(page.locator('.jp-mcp-popup')).not.toContainText(
        'Environment Variables'
      );
    });

    test('should show Save button for user-editable server', async ({
      page
    }) => {
      await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    });
  });
});
