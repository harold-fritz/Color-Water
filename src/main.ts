import { App } from './App';

/** Bumped on each deploy so the running version is identifiable. */
const BUILD_VERSION = 'v1.0.1 (2026-06-27)';

/** Entry point: boots the DOM shell once the document is ready. */
function boot(): void {
  // eslint-disable-next-line no-console
  console.log(`%cColor Walter ${BUILD_VERSION}`, 'color:#f4c430;font-weight:bold');
  new App().start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
