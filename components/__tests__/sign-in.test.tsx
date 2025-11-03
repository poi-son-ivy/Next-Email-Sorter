import { render, screen } from '@testing-library/react';
import { SignIn } from '../sign-in';

// Mock the auth module
jest.mock('@/lib/auth', () => ({
  signIn: jest.fn(),
}));

describe('SignIn', () => {
  it('renders sign in button', () => {
    render(<SignIn />);

    const button = screen.getByRole('button', { name: /sign in with google/i });
    expect(button).toBeInTheDocument();
  });

  it('renders as a form', () => {
    const { container } = render(<SignIn />);

    const form = container.querySelector('form');
    expect(form).toBeInTheDocument();
  });

  it('button has correct styling', () => {
    render(<SignIn />);

    const button = screen.getByRole('button', { name: /sign in with google/i });
    expect(button.className).toContain('bg-blue-600');
    expect(button.className).toContain('text-white');
    expect(button.className).toContain('rounded-lg');
  });

  it('button type is submit', () => {
    render(<SignIn />);

    const button = screen.getByRole('button', { name: /sign in with google/i });
    expect(button).toHaveAttribute('type', 'submit');
  });
});
