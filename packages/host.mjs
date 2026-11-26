export let API_URL = '';
let host;

export function configureHost(options) {
  if (typeof options?.API_URL !== 'string' || typeof options.fetchJson !== 'function'
    || typeof options.getAuthEventName !== 'function') {
    throw new TypeError('Provide the host API_URL, fetchJson, and getAuthEventName.');
  }
  API_URL = options.API_URL.replace(/\/$/, '');
  host = options;
}

function hostFunction(name, args) {
  if (typeof host?.[name] !== 'function') {
    throw new Error(`Configure the game host with ${name} before opening this page.`);
  }
  return host[name](...args);
}

export function fetchJson(...args) {
  return hostFunction('fetchJson', args);
}

export function getAuthEventName(...args) {
  return hostFunction('getAuthEventName', args);
}

export function readStoredUser(...args) {
  return hostFunction('readStoredUser', args);
}

export function refreshStoredUser(...args) {
  return hostFunction('refreshStoredUser', args);
}
