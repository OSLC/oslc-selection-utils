/**
 * Copyright (c) 2025 Andrew Berezovskyi
 *
 * SPDX-License-Identifier: EPL-2.0
 */

import { OslcPostMessageHelper } from '../oslc-postmessage-helper.js';
import { OslcProtocol, OslcResource, OslcResponse } from '../types.js';

describe('OslcPostMessageHelper', () => {
  let originalWindowName: string;
  const originalWindowParent = window.parent;

  beforeEach(() => {
    originalWindowName = window.name;
    window.location.hash = '';

    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    window.name = originalWindowName;
    delete (window as any).parent;
    (window as any).parent = originalWindowParent;
    window.location.hash = '';
  });

  describe('buildDialogUrl', () => {
    it('should append default postMessage protocol fragment to base URL', () => {
      const baseUrl = 'https://example.com/dialog';
      const result = OslcPostMessageHelper.buildDialogUrl(baseUrl);
      expect(result).toBe(`https://example.com/dialog${OslcProtocol.PostMessage}`);
    });

    it('should append specified protocol fragment to base URL', () => {
      const baseUrl = 'https://example.com/dialog';
      const result = OslcPostMessageHelper.buildDialogUrl(baseUrl, OslcProtocol.WindowName);
      expect(result).toBe(`https://example.com/dialog${OslcProtocol.WindowName}`);
    });
  });

  describe('sendResponse', () => {
    it('should respond via postMessage when protocol is PostMessage', () => {
      const parentPostMessageSpy = jest.fn();
      delete (window as any).parent;
      window.parent = { postMessage: parentPostMessageSpy } as any;

      const response: OslcResponse = {
        'oslc:results': [{ 'rdf:resource': 'https://example.com/res/1', 'oslc:label': 'Resource 1' }]
      };

      OslcPostMessageHelper.sendResponse(response, OslcProtocol.PostMessage);

      const expectedString = `oslc-response:${JSON.stringify(response)}`;
      expect(parentPostMessageSpy).toHaveBeenCalledWith(expectedString, '*');
    });

    it('should respond via window.postMessage if window.parent is null', () => {
      const windowPostMessageSpy = jest.spyOn(window, 'postMessage').mockImplementation(() => {});
      delete (window as any).parent;
      (window as any).parent = null;

      OslcPostMessageHelper.sendResponse('oslc-response:test', OslcProtocol.PostMessage);

      expect(windowPostMessageSpy).toHaveBeenCalledWith('oslc-response:test', '*');
    });

    it('should respond via WindowName protocol when requested', () => {
      window.name = 'https://example.com/callback';

      // Suppress jsdom navigation error since jsdom throws when setting location.href in tests
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const responseString = 'oslc-response:{"oslc:results":[]}';
      try {
        OslcPostMessageHelper.sendResponse(responseString, OslcProtocol.WindowName);
      } catch (e) {
        // Ignored
      }

      expect(window.name).toBe(responseString);
      consoleErrorSpy.mockRestore();
    });

    it('should detect protocol from window.location.hash if protocol not passed', () => {
      const parentPostMessageSpy = jest.fn();
      delete (window as any).parent;
      window.parent = { postMessage: parentPostMessageSpy } as any;

      window.location.hash = OslcProtocol.PostMessage;

      OslcPostMessageHelper.sendResponse('test-msg');

      expect(parentPostMessageSpy).toHaveBeenCalledWith('test-msg', '*');
    });

    it('should warn and fallback to postMessage if no protocol detected in hash', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const parentPostMessageSpy = jest.fn();
      delete (window as any).parent;
      window.parent = { postMessage: parentPostMessageSpy } as any;

      window.location.hash = '';

      OslcPostMessageHelper.sendResponse('test-fallback');

      expect(consoleWarnSpy).toHaveBeenCalledWith('No OSLC protocol detected, defaulting to postMessage');
      expect(parentPostMessageSpy).toHaveBeenCalledWith('test-fallback', '*');
    });
  });

  describe('convenience send methods', () => {
    it('sendCancelResponse should send an empty oslc:results response', () => {
      const sendResponseSpy = jest.spyOn(OslcPostMessageHelper, 'sendResponse').mockImplementation(() => {});

      OslcPostMessageHelper.sendCancelResponse();

      expect(sendResponseSpy).toHaveBeenCalledWith({ 'oslc:results': [] });
    });

    it('sendSelectionResponse should send selected resources', () => {
      const sendResponseSpy = jest.spyOn(OslcPostMessageHelper, 'sendResponse').mockImplementation(() => {});
      const resources: OslcResource[] = [
        { 'rdf:resource': 'https://example.com/1', 'oslc:label': 'Res 1' },
        { 'rdf:resource': 'https://example.com/2', 'oslc:label': 'Res 2' }
      ];

      OslcPostMessageHelper.sendSelectionResponse(resources);

      expect(sendResponseSpy).toHaveBeenCalledWith({ 'oslc:results': resources });
    });

    it('sendCreationResponse should send single created resource', () => {
      const sendResponseSpy = jest.spyOn(OslcPostMessageHelper, 'sendResponse').mockImplementation(() => {});
      const resource: OslcResource = { 'rdf:resource': 'https://example.com/new', 'oslc:label': 'New Res' };

      OslcPostMessageHelper.sendCreationResponse(resource);

      expect(sendResponseSpy).toHaveBeenCalledWith({ 'oslc:results': [resource] });
    });
  });

  describe('listener registration', () => {
    let mockIframe: HTMLIFrameElement;
    let iframeWindow: Window;

    beforeEach(() => {
      iframeWindow = {} as Window;
      mockIframe = {
        contentWindow: iframeWindow
      } as HTMLIFrameElement;
    });

    describe('registerRawResponseListener', () => {
      it('should invoke messageHandler on valid OSLC message from iframe contentWindow', () => {
        const messageHandler = jest.fn();
        const cleanup = OslcPostMessageHelper.registerRawResponseListener(mockIframe, messageHandler);

        const validEvent = new MessageEvent('message', {
          data: 'oslc-response:{"oslc:results":[]}',
          source: iframeWindow
        });

        window.dispatchEvent(validEvent);

        expect(messageHandler).toHaveBeenCalledWith('oslc-response:{"oslc:results":[]}');

        // Test cleanup
        cleanup();
        window.dispatchEvent(validEvent);
        expect(messageHandler).toHaveBeenCalledTimes(1);
      });

      it('should ignore message if source does not match iframe contentWindow', () => {
        const messageHandler = jest.fn();
        const cleanup = OslcPostMessageHelper.registerRawResponseListener(mockIframe, messageHandler);

        const invalidEvent = new MessageEvent('message', {
          data: 'oslc-response:{"oslc:results":[]}',
          source: {} as Window
        });

        window.dispatchEvent(invalidEvent);

        expect(messageHandler).not.toHaveBeenCalled();
        cleanup();
      });

      it('should ignore message if data does not start with oslc-response:', () => {
        const messageHandler = jest.fn();
        const cleanup = OslcPostMessageHelper.registerRawResponseListener(mockIframe, messageHandler);

        const invalidEvent = new MessageEvent('message', {
          data: 'other-prefix:hello',
          source: iframeWindow
        });

        window.dispatchEvent(invalidEvent);

        expect(messageHandler).not.toHaveBeenCalled();
        cleanup();
      });
    });

    describe('registerSelectionListener', () => {
      it('should parse response and pass results to resourceHandler, running preprocessingHandler if provided', () => {
        const resourceHandler = jest.fn();
        const preprocessingHandler = jest.fn();
        const cleanup = OslcPostMessageHelper.registerSelectionListener(
          mockIframe,
          resourceHandler,
          preprocessingHandler
        );

        const resources: OslcResource[] = [
          { 'rdf:resource': 'https://example.com/res/1', 'oslc:label': 'Label 1' }
        ];

        const validEvent = new MessageEvent('message', {
          data: `oslc-response:${JSON.stringify({ 'oslc:results': resources })}`,
          source: iframeWindow
        });

        window.dispatchEvent(validEvent);

        expect(preprocessingHandler).toHaveBeenCalledTimes(1);
        expect(resourceHandler).toHaveBeenCalledWith(resources);

        cleanup();
      });

      it('should handle JSON parse error gracefully and log to console.error', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const resourceHandler = jest.fn();

        const cleanup = OslcPostMessageHelper.registerSelectionListener(mockIframe, resourceHandler);

        const invalidEvent = new MessageEvent('message', {
          data: 'oslc-response:invalid-json',
          source: iframeWindow
        });

        window.dispatchEvent(invalidEvent);

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(resourceHandler).not.toHaveBeenCalled();
        cleanup();
      });
    });

    describe('registerCreationListener', () => {
      it('should parse response, execute preprocessing, and pass url/label to single resource handler', () => {
        const resourceHandler = jest.fn();
        const preprocessingHandler = jest.fn();
        const cleanup = OslcPostMessageHelper.registerCreationListener(
          mockIframe,
          resourceHandler,
          preprocessingHandler
        );

        const resource: OslcResource = { 'rdf:resource': 'https://example.com/created/1', 'oslc:label': 'Created 1' };

        const validEvent = new MessageEvent('message', {
          data: `oslc-response:${JSON.stringify({ 'oslc:results': [resource] })}`,
          source: iframeWindow
        });

        window.dispatchEvent(validEvent);

        expect(preprocessingHandler).toHaveBeenCalledTimes(1);
        expect(resourceHandler).toHaveBeenCalledWith('https://example.com/created/1', 'Created 1');

        cleanup();
      });

      it('should do nothing if oslc:results array is empty', () => {
        const resourceHandler = jest.fn();
        const cleanup = OslcPostMessageHelper.registerCreationListener(mockIframe, resourceHandler);

        const emptyEvent = new MessageEvent('message', {
          data: `oslc-response:${JSON.stringify({ 'oslc:results': [] })}`,
          source: iframeWindow
        });

        window.dispatchEvent(emptyEvent);

        expect(resourceHandler).not.toHaveBeenCalled();
        cleanup();
      });

      it('should handle JSON parse error gracefully', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const resourceHandler = jest.fn();

        const cleanup = OslcPostMessageHelper.registerCreationListener(mockIframe, resourceHandler);

        const invalidEvent = new MessageEvent('message', {
          data: 'oslc-response:{bad json',
          source: iframeWindow
        });

        window.dispatchEvent(invalidEvent);

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(resourceHandler).not.toHaveBeenCalled();
        cleanup();
      });
    });
  });
});
