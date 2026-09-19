import './oslc-selection-button';
import { OslcSelectionButton } from './oslc-selection-button';

describe('OslcSelectionButton edge cases', () => {
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = jest.fn();

    // Mock HTMLDialogElement methods if not implemented in jsdom
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = jest.fn();
    } else {
      jest.spyOn(HTMLDialogElement.prototype, 'showModal');
    }

    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = jest.fn();
    } else {
      jest.spyOn(HTMLDialogElement.prototype, 'close');
    }
  });

  afterEach(() => {
    console.error = originalConsoleError;
    jest.restoreAllMocks();
  });

  test('logs error and does not open dialog when dialogUrl is missing', () => {
    const element = document.createElement('oslc-selection-button') as OslcSelectionButton;
    document.body.appendChild(element);

    const button = element.shadowRoot?.querySelector('button');
    expect(button).not.toBeNull();

    // Click button without setting dialog-url
    button?.click();

    expect(console.error).toHaveBeenCalledWith(
      'OSLC Selection Button: dialog-url attribute is required'
    );
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();

    document.body.removeChild(element);
  });
});
