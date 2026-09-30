import { portalService } from './portal-client.js';
import { t, watchLanguage } from './portal-i18n.js';

let state = 'loading';
const render = () => { document.getElementById('auth-status').textContent = t(state); };
watchLanguage(render);
try {
  const service = portalService({ callback: true });
  await service.completeAccess();
  state = 'verified'; render();
  location.replace('mis-clases.html');
} catch (error) {
  state = error.code === 'UNAVAILABLE' ? 'unavailable' : 'invalid';
  render();
  document.getElementById('auth-return').hidden = false;
} finally {
  // Auth handles the fragment/session itself. Clean even failed links; never log/read tokens.
  history.replaceState(null, '', location.pathname);
}
