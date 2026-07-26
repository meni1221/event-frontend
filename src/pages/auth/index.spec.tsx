/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import axe from 'axe-core';
import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../../components/feedback';
import { AuthPanel } from '.';

const labels = new Proxy<Record<string, string>>({}, {
  get: (_target, property) => String(property),
});

const renderAuthPanel = (sessionExpired = false) => render(
  <MantineProvider>
    <FeedbackProvider>
      <AuthPanel labels={labels} onAuthenticated={vi.fn()} sessionExpired={sessionExpired} />
    </FeedbackProvider>
  </MantineProvider>,
);

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(() => cleanup());

describe('AuthPanel accessibility', () => {
  it('exposes the authentication form through semantic names and landmarks', () => {
    renderAuthPanel();

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'authTitle' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'authTitle' })).toBeInTheDocument();
    expect(screen.getByLabelText('email')).toBeRequired();
    expect(screen.getByLabelText('password')).toBeRequired();
    expect(screen.getByRole('button', { name: 'signInWithGoogle' })).toBeEnabled();
  });

  it('announces an expired session without hiding the sign-in controls', () => {
    renderAuthPanel(true);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('sessionExpired');
    expect(alert).toHaveTextContent('sessionExpiredHint');
    expect(screen.getByLabelText('email')).toBeEnabled();
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = renderAuthPanel(true);
    const results = await axe.run(container);

    expect(results.violations).toEqual([]);
  });
});
