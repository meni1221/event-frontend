/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import axe from 'axe-core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from '.';

const loggerMocks = vi.hoisted(() => ({ fatal: vi.fn() }));

vi.mock('../../utils/logger', () => ({
  appLogger: { fatal: loggerMocks.fatal },
}));

const BrokenScreen = () => {
  throw new Error('Sensitive technical failure');
};

describe('AppErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.documentElement.lang = 'he';
    loggerMocks.fatal.mockClear();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    consoleError.mockRestore();
  });

  it('renders healthy application content unchanged', () => {
    render(<AppErrorBoundary><p>Healthy content</p></AppErrorBoundary>);

    expect(screen.getByText('Healthy content')).toBeInTheDocument();
    expect(loggerMocks.fatal).not.toHaveBeenCalled();
  });

  it('shows an accessible Hebrew recovery screen and records the technical error', async () => {
    const { container } = render(<AppErrorBoundary><BrokenScreen /></AppErrorBoundary>);

    expect(screen.getByRole('main')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('alert')).toHaveTextContent('לא הצלחנו להציג את המסך');
    expect(screen.getByRole('button', { name: 'טעינה מחדש של המערכת' })).toBeEnabled();
    expect(screen.queryByText('Sensitive technical failure')).not.toBeInTheDocument();
    expect(loggerMocks.fatal).toHaveBeenCalledWith(
      'frontend.render',
      'React render failed',
      expect.objectContaining({ message: 'Sensitive technical failure' }),
    );

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  it('uses English recovery copy when the document language is English', () => {
    document.documentElement.lang = 'en';

    render(<AppErrorBoundary><BrokenScreen /></AppErrorBoundary>);

    expect(screen.getByRole('main')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('heading', { name: 'The application could not display this screen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the application' })).toBeEnabled();
  });
});
