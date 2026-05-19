import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IFormRendererRegistry } from '@jupyterlab/ui-components';

import { McpServersSettings } from './mcp-servers-settings';

/**
 * Initialization data for the jupyter-mcp-manager extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyter-mcp-manager:plugin',
  description: 'A JupyterLab extension to manage MCP servers.',
  autoStart: true,
  optional: [IFormRendererRegistry, ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    formRenderer: IFormRendererRegistry | null,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('JupyterLab extension jupyter-mcp-manager is activated!');

    if (!settingRegistry) {
      return;
    }

    settingRegistry.load(plugin.id).then(async settings => {
      formRenderer?.addRenderer(`${plugin.id}.mcpSettings`, {
        fieldRenderer: (props: any) =>
          McpServersSettings({
            serverSettings: app.serviceManager.serverSettings,
            settings,
            ...props
          })
      });
    });
  }
};

export default plugin;
