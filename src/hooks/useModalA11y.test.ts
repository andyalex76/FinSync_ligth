import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useModalA11y } from './useModalA11y';

describe('useModalA11y hook', () => {
  let container: HTMLDivElement;
  let btn1: HTMLButtonElement;
  let btn2: HTMLButtonElement;
  let outsideBtn: HTMLButtonElement;

  beforeEach(() => {
    container = document.createElement('div');
    outsideBtn = document.createElement('button');
    outsideBtn.textContent = 'Outside';
    document.body.appendChild(outsideBtn);
    outsideBtn.focus();

    btn1 = document.createElement('button');
    btn1.textContent = 'First';
    btn2 = document.createElement('button');
    btn2.textContent = 'Second';
    container.appendChild(btn1);
    container.appendChild(btn2);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('triggers onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useModalA11y({
        isOpen: true,
        onClose,
      })
    );

    result.current.modalRef.current = container;

    const escEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(escEvent);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus forward when Tab is pressed on the last focusable element', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useModalA11y({
        isOpen: true,
        onClose,
      })
    );

    result.current.modalRef.current = container;
    btn2.focus();
    expect(document.activeElement).toBe(btn2);

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    const prevented = !window.dispatchEvent(tabEvent);

    expect(prevented).toBe(true);
    expect(document.activeElement).toBe(btn1);
  });

  it('traps focus backward when Shift+Tab is pressed on the first focusable element', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useModalA11y({
        isOpen: true,
        onClose,
      })
    );

    result.current.modalRef.current = container;
    btn1.focus();
    expect(document.activeElement).toBe(btn1);

    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const prevented = !window.dispatchEvent(shiftTabEvent);

    expect(prevented).toBe(true);
    expect(document.activeElement).toBe(btn2);
  });

  it('prevents and restores body scroll overflow', () => {
    expect(document.body.style.overflow).toBe('');

    const { unmount } = renderHook(() =>
      useModalA11y({
        isOpen: true,
        onClose: () => {},
      })
    );

    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
