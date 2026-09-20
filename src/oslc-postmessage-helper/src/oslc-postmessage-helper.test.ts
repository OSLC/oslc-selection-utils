import { OslcPostMessageHelper } from './oslc-postmessage-helper.js';
import { OslcProtocol } from './types.js';

type MockWindow = {
  name: string;
  location: {
    hash: string;
    href: string;
  };
};

const originalWindow = (globalThis as { window?: Window }).window;

function installWindow(window: MockWindow): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: window,
  });
}

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: Window }).window;
  } else {
    installWindow(originalWindow as unknown as MockWindow);
  }
  jest.restoreAllMocks();
});

test('rejects javascript Window Name return URLs before navigation', () => {
  const window: MockWindow = {
    name: 'javascript:globalThis.__oslcWindowNameXss = true',
    location: {
      hash: OslcProtocol.WindowName,
      href: 'https://provider.example/dialog',
    },
  };
  installWindow(window);
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  OslcPostMessageHelper.sendResponse('oslc-response:{}', OslcProtocol.WindowName);

  expect(window.name).toBe('javascript:globalThis.__oslcWindowNameXss = true');
  expect(window.location.href).toBe('https://provider.example/dialog');
  expect(warning).toHaveBeenCalledWith(
    'Ignoring OSLC Window Name return URL with javascript: scheme',
  );
});

test('rejects file Window Name return URLs before navigation', () => {
  const window: MockWindow = {
    name: 'file:///Users/example/return.html',
    location: {
      hash: OslcProtocol.WindowName,
      href: 'https://provider.example/dialog',
    },
  };
  installWindow(window);
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  OslcPostMessageHelper.sendResponse('oslc-response:{}', OslcProtocol.WindowName);

  expect(window.name).toBe('file:///Users/example/return.html');
  expect(window.location.href).toBe('https://provider.example/dialog');
  expect(warning).toHaveBeenCalledWith(
    'Ignoring OSLC Window Name return URL with file: scheme',
  );
});

test('preserves valid HTTPS Window Name return URLs', () => {
  const window: MockWindow = {
    name: 'https://consumer.example/return',
    location: {
      hash: OslcProtocol.WindowName,
      href: 'https://provider.example/dialog',
    },
  };
  installWindow(window);

  OslcPostMessageHelper.sendResponse('oslc-response:{}', OslcProtocol.WindowName);

  expect(window.name).toBe('oslc-response:{}');
  expect(window.location.href).toBe('https://consumer.example/return');
});

test('rejects malformed Window Name return URLs', () => {
  const window: MockWindow = {
    name: 'https://[invalid',
    location: {
      hash: OslcProtocol.WindowName,
      href: 'https://provider.example/dialog',
    },
  };
  installWindow(window);
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  OslcPostMessageHelper.sendResponse('oslc-response:{}', OslcProtocol.WindowName);

  expect(window.name).toBe('https://[invalid');
  expect(window.location.href).toBe('https://provider.example/dialog');
  expect(warning).toHaveBeenCalledWith('Ignoring invalid OSLC Window Name return URL');
});
