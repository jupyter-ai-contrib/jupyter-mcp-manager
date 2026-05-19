import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { IFormRendererRegistry } from '@jupyterlab/ui-components';

import { McpServersSettings } from './mcp-servers-settings';

/**
 * Initialization data for the jupyter-mcp-manager extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyter-mcp-manager:plugin',
  description: 'A JupyterLab extension to manage MCP servers.',
  autoStart: true,
  optional: [IFormRendererRegistry, ISettingRegistry, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    formRenderer: IFormRendererRegistry | null,
    settingRegistry: ISettingRegistry | null,
    translator: ITranslator | null
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
            translator: translator ?? nullTranslator,
            ...props
          })
      });
    });
  }
};

export default plugin;
