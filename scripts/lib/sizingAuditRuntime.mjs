import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export async function openSizingAuditRuntime() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const server = await createServer({
    root,
    cacheDir: `${root}/qa/.sizing-audit-cache`,
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true, watch: null },
    plugins: [{
      name: 'audit-private-sizing-hook',
      enforce: 'pre',
      transform(source, identifier) {
        if (!identifier.replaceAll('\\', '/').endsWith('/src/App.jsx')) return null;
        return `${source}\nexport const auditDefaults = defaultProject;\nexport const auditNormalizeRecord = normalizeLoadedRecord;\nexport function AuditSizingProbe({ project: auditProject, loads: auditLoads, capture }) { capture(useSizing(auditProject, auditLoads)); return null; }\n`;
      },
    }, react()],
  });
  try {
    const module = await server.ssrLoadModule('/src/App.jsx');
    return {
      defaults: module.auditDefaults,
      normalizeRecord: module.auditNormalizeRecord,
      size(project, loads) {
        let result;
        renderToStaticMarkup(React.createElement(module.AuditSizingProbe, {
          project, loads, capture(value) { result = value; },
        }));
        return result;
      },
      close: () => server.close(),
    };
  } catch (error) {
    await server.close();
    throw error;
  }
}
