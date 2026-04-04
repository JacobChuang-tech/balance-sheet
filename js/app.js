import { initNav } from './components/nav.js';
import { getSettings, syncFromDrive } from './store.js';
import { initGoogleAuth, onSignInChange } from './gdrive.js';

const views = {};

async function loadView(name) {
  if (!views[name]) {
    const module = await import(`./views/${name}.js`);
    views[name] = module;
  }
  return views[name];
}

function getRoute() {
  const hash = window.location.hash || '#/dashboard';
  const route = hash.replace('#/', '') || 'dashboard';
  return route;
}

async function render() {
  const route = getRoute();
  const app = document.getElementById('app');

  // Show loading state
  app.classList.add('view-loading');

  try {
    const view = await loadView(route);
    app.innerHTML = '';
    app.classList.remove('view-loading');
    if (view.render) {
      const content = view.render();
      if (typeof content === 'string') {
        app.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        app.appendChild(content);
      }
    }
    if (view.mount) {
      view.mount(app);
    }
  } catch (e) {
    console.error(`Failed to load view: ${route}`, e);
    app.classList.remove('view-loading');
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🚧</div>
        <h3>View not found</h3>
        <p>The page "${route}" doesn't exist yet.</p>
        <a href="#/dashboard" class="btn btn-primary">Go to Dashboard</a>
      </div>
    `;
  }
}

function applyTheme() {
  const settings = getSettings();
  document.documentElement.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light');
}

// Initialize app
function init() {
  applyTheme();
  initNav();
  render();
  window.addEventListener('hashchange', render);

  // Google Drive auth — reads client ID from a meta tag or config
  const clientId = document.querySelector('meta[name="google-client-id"]')?.content;
  if (clientId) {
    initGoogleAuth(clientId);
    onSignInChange(async (signedIn) => {
      if (signedIn) {
        const updated = await syncFromDrive();
        if (updated) applyTheme();
      }
      render();
    });
  }
}

// Expose for settings toggle
window.__applyTheme = applyTheme;
window.__rerender = render;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
