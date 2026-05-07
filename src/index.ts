import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './request';

/**
 * Initialization data for the jupyter-mcp-manager extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyter-mcp-manager:plugin',
  description: 'A JupyterLab extension to manage MCP servers.',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyter-mcp-manager is activated!');

    requestAPI<any>('servers', app.serviceManager.serverSettings)
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The jupyter_mcp_manager server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default plugin;
