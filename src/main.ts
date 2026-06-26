import { App } from './App';

/** Entry point: boots the DOM shell once the document is ready. */
function boot(): void {
  new App().start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
