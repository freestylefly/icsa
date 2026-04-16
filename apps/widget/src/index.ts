/**
 * 智能客服 Web Widget
 * 使用方式：
 * 
 * 1. 在 HTML 中引入：
 * <script src="https://your-domain.com/widget.js"></script>
 * 
 * 2. 初始化：
 * <script>
 *   IntelligentCustomerServiceWidget.init({
 *     apiBaseUrl: 'https://your-api.com',
 *     tenantId: 'your-tenant-id',
 *     agentId: 'your-agent-id',
 *   });
 * </script>
 */

import { createWidget } from './components/Widget';

export interface WidgetConfig {
  apiBaseUrl: string;
  tenantId: string;
  agentId?: string;
  theme?: {
    primaryColor?: string;
    position?: 'left' | 'right';
  };
}

let widgetInstance: any = null;

export const init = (config: WidgetConfig) => {
  if (widgetInstance) {
    console.warn('Widget 已初始化');
    return;
  }

  widgetInstance = createWidget(config);
  widgetInstance.render();
};

export const destroy = () => {
  if (widgetInstance) {
    widgetInstance.destroy();
    widgetInstance = null;
  }
};

export const open = () => {
  widgetInstance?.open();
};

export const close = () => {
  widgetInstance?.close();
};

export default {
  init,
  destroy,
  open,
  close,
};
