import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { IFormRendererRegistry } from '@jupyterlab/ui-components';

import { McpManager } from './mcp-manager';
import { McpServersSettings } from './mcp-servers-settings';
import { IMcpManager, PLUGIN_IDS } from './tokens';

/**
 * Main extension plugin.
 * This plugin provides:
 * - A settings panel for managing MCP servers (via ISettingRegistry)
 * - An IMcpManager service (via token) that is the source of truth for MCP server configs
 */
const plugin: JupyterFrontEndPlugin<IMcpManager> = {
  id: PLUGIN_IDS.manager,
  description: 'A JupyterLab extension to manage MCP servers.',
  autoStart: true,
  provides: IMcpManager,
  optional: [IFormRendererRegistry, ISettingRegistry, ITranslator],
  activate: async (
    app: JupyterFrontEnd,
    formRenderer: IFormRendererRegistry | null,
    settingRegistry: ISettingRegistry | null,
    translator: ITranslator | null
  ): Promise<IMcpManager> => {
    console.log('JupyterLab extension jupyter-mcp-manager is activated!');

    const trans = translator ?? nullTranslator;
    const serverSettings = app.serviceManager.serverSettings;

    const settings = await settingRegistry?.load(PLUGIN_IDS.manager);

    const manager = new McpManager({ serverSettings, settings });

    // Register settings panel
    if (settings) {
      formRenderer?.addRenderer(`${plugin.id}.mcpSettings`, {
        fieldRenderer: (props: any) =>
          McpServersSettings({
            manager,
            settings,
            translator: trans,
            ...props
          })
      });
    }

    return manager;
  }
};

export default plugin;
export { IMcpManager, IMcpManager as IMcpManagerToken, McpManager };
