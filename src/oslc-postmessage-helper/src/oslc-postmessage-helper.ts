/**
 * Copyright (c) 2025 Andrew Berezovskyi
 *
 * SPDX-License-Identifier: EPL-2.0
 */

import {
  OslcResource,
  OslcResponse,
  OslcProtocol,
  OslcMessageHandler,
  OslcResourceHandler,
  OslcSingleResourceHandler,
  OslcPreprocessingHandler
} from './types.js';

/**
 * OSLC PostMessage Helper
 * 
 * A focused TypeScript module for handling OSLC postMessage communication
 * in delegated UIs according to the OSLC specification section 4.3.
 * 
 * @see https://docs.oasis-open-projects.org/oslc-op/core/v3.0/os/dialogs.html#messaging_conformance
 */
export class OslcPostMessageHelper {
  private static readonly OSLC_RESPONSE_HEADER = 'oslc-response:';

  /**
   * Sends an OSLC response using the appropriate protocol (window name or postMessage)
   * 
   * @param response - The OSLC response object or string
   * @param protocol - Optional protocol to force, otherwise detected from URL hash
   */
  public static sendResponse(response: OslcResponse | string, protocol?: OslcProtocol): void {
    const responseString = typeof response === 'string' 
      ? response 
      : `${this.OSLC_RESPONSE_HEADER}${JSON.stringify(response)}`;

    const detectedProtocol = protocol || this.detectProtocol();

    switch (detectedProtocol) {
      case OslcProtocol.WindowName:
        this.respondWithWindowName(responseString);
        break;
      case OslcProtocol.PostMessage:
        this.respondWithPostMessage(responseString);
        break;
      default:
        console.warn('No OSLC protocol detected, defaulting to postMessage');
        this.respondWithPostMessage(responseString);
    }
  }

  /**
   * Sends a cancellation response with empty results
   */
  public static sendCancelResponse(): void {
    const cancelResponse: OslcResponse = { 'oslc:results': [] };
    this.sendResponse(cancelResponse);
  }

  /**
   * Sends a response for selected resources
   * 
   * @param resources - Array of selected OSLC resources
   */
  public static sendSelectionResponse(resources: OslcResource[]): void {
    const response: OslcResponse = { 'oslc:results': resources };
    this.sendResponse(response);
  }

  /**
   * Sends a response for a single created resource
   * 
   * @param resource - The created OSLC resource
   */
  public static sendCreationResponse(resource: OslcResource): void {
    const response: OslcResponse = { 'oslc:results': [resource] };
    this.sendResponse(response);
  }

  /**
   * Registers a listener for raw OSLC postMessage responses
   * 
   * @param iframeElement - The iframe element containing the delegated UI
   * @param messageHandler - Handler function for the raw message
   * @returns Cleanup function to remove the event listener
   */
  public static registerRawResponseListener(
    iframeElement: HTMLIFrameElement,
    messageHandler: OslcMessageHandler
  ): () => void {
    const listener = (event: MessageEvent) => {
      if (this.isValidOslcMessage(event, iframeElement)) {
        messageHandler(event.data);
      }
    };

    window.addEventListener('message', listener, false);
    
    return () => window.removeEventListener('message', listener, false);
  }

  /**
   * Registers a listener for OSLC selection dialog responses
   * 
   * @param iframeElement - The iframe element containing the selection dialog
   * @param resourceHandler - Handler function for the selected resources
   * @param preprocessingHandler - Optional preprocessing function called before handling resources
   * @returns Cleanup function to remove the event listener
   */
  public static registerSelectionListener(
    iframeElement: HTMLIFrameElement,
    resourceHandler: OslcResourceHandler,
    preprocessingHandler?: OslcPreprocessingHandler
  ): () => void {
    const listener = (event: MessageEvent) => {
      if (this.isValidOslcMessage(event, iframeElement)) {
        try {
          const message = event.data.slice(this.OSLC_RESPONSE_HEADER.length);
          const parsedResponse: OslcResponse = JSON.parse(message);
          
          if (preprocessingHandler) {
            preprocessingHandler();
          }
          
          resourceHandler(parsedResponse['oslc:results']);
        } catch (error) {
          console.error('Failed to parse OSLC response:', error);
        }
      }
    };

    window.addEventListener('message', listener, false);
    
    return () => window.removeEventListener('message', listener, false);
  }

  /**
   * Registers a listener for OSLC creation dialog responses
   * 
   * @param iframeElement - The iframe element containing the creation dialog
   * @param resourceHandler - Handler function for the created resource
   * @param preprocessingHandler - Optional preprocessing function called before handling the resource
   * @returns Cleanup function to remove the event listener
   */
  public static registerCreationListener(
    iframeElement: HTMLIFrameElement,
    resourceHandler: OslcSingleResourceHandler,
    preprocessingHandler?: OslcPreprocessingHandler
  ): () => void {
    const listener = (event: MessageEvent) => {
      if (this.isValidOslcMessage(event, iframeElement)) {
        try {
          const message = event.data.slice(this.OSLC_RESPONSE_HEADER.length);
          const parsedResponse: OslcResponse = JSON.parse(message);
          
          if (preprocessingHandler) {
            preprocessingHandler();
          }
          
          const resources = parsedResponse['oslc:results'];
          if (resources.length > 0) {
            const resource = resources[0];
            resourceHandler(resource['rdf:resource'], resource['oslc:label']);
          }
        } catch (error) {
          console.error('Failed to parse OSLC response:', error);
        }
      }
    };

    window.addEventListener('message', listener, false);
    
    return () => window.removeEventListener('message', listener, false);
  }

  /**
   * Builds an OSLC dialog URL with the appropriate protocol fragment
   * 
   * @param baseUrl - The base URL of the dialog
   * @param protocol - The protocol to use (defaults to postMessage)
   * @returns The complete dialog URL with protocol fragment
   */
  public static buildDialogUrl(baseUrl: string, protocol: OslcProtocol = OslcProtocol.PostMessage): string {
    const url = new URL(baseUrl);
    url.hash = protocol;
    return url.toString();
  }

  /**
   * Detects the OSLC protocol from the current window's URL hash
   */
  private static detectProtocol(): OslcProtocol | null {
    const hash = window.location.hash;
    
    if (hash === OslcProtocol.WindowName) {
      return OslcProtocol.WindowName;
    } else if (hash === OslcProtocol.PostMessage) {
      return OslcProtocol.PostMessage;
    }
    
    return null;
  }

  /**
   * Checks if a message event is a valid OSLC response
   */
  private static isValidOslcMessage(event: MessageEvent, iframeElement: HTMLIFrameElement): boolean {
    return (
      event.source === iframeElement.contentWindow &&
      typeof event.data === 'string' &&
      event.data.indexOf(this.OSLC_RESPONSE_HEADER) === 0
    );
  }

  /**
   * Responds using the window name protocol
   */
  private static respondWithWindowName(response: string): void {
    let returnURL: URL;
    try {
      returnURL = new URL(window.name, window.location.href);
    } catch {
      console.warn('Ignoring invalid OSLC Window Name return URL');
      return;
    }

    if (returnURL.protocol !== 'http:' && returnURL.protocol !== 'https:') {
      console.warn(`Ignoring OSLC Window Name return URL with ${returnURL.protocol} scheme`);
      return;
    }

    window.name = response;
    window.location.href = returnURL.href;
  }

  /**
   * Responds using the postMessage protocol
   */
  private static respondWithPostMessage(response: string): void {
    if (window.parent !== null) {
      window.parent.postMessage(response, '*');
    } else {
      window.postMessage(response, '*');
    }
  }
}
