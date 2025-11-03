import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryCard } from '../category-card';
import { Category } from '@/lib/generated/prisma';

const mockCategory: Category = {
  id: '1',
  userId: 'user-1',
  name: 'Newsletters',
  description: 'Marketing and promotional emails',
  color: '#3B82F6',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
};

describe('CategoryCard', () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders category information correctly', () => {
    render(<CategoryCard category={mockCategory} />);

    expect(screen.getByText('Newsletters')).toBeInTheDocument();
    expect(screen.getByText('Marketing and promotional emails')).toBeInTheDocument();
  });

  it('displays color indicator with correct color', () => {
    const { container } = render(<CategoryCard category={mockCategory} />);

    const colorIndicator = container.querySelector('[style*="background-color"]');
    expect(colorIndicator).toHaveStyle({ backgroundColor: '#3B82F6' });
  });

  it('uses default color when category color is null', () => {
    const categoryWithoutColor = { ...mockCategory, color: null };
    const { container } = render(<CategoryCard category={categoryWithoutColor} />);

    const colorIndicator = container.querySelector('[style*="background-color"]');
    expect(colorIndicator).toHaveStyle({ backgroundColor: '#3B82F6' }); // Default blue
  });

  it('calls onClick when card is clicked', () => {
    render(<CategoryCard category={mockCategory} onClick={mockOnClick} />);

    const card = screen.getByText('Newsletters').closest('div');
    fireEvent.click(card!);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when onClick is not provided', () => {
    render(<CategoryCard category={mockCategory} />);

    const card = screen.getByText('Newsletters').closest('div');
    fireEvent.click(card!);

    // Should not throw error
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('applies selected styles when isSelected is true', () => {
    const { container } = render(
      <CategoryCard category={mockCategory} isSelected={true} />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-blue-500');
    expect(card.className).toContain('ring-2');
  });

  it('applies default styles when isSelected is false', () => {
    const { container } = render(
      <CategoryCard category={mockCategory} isSelected={false} />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-gray-200');
    expect(card.className).not.toContain('ring-2');
  });

  it('renders arrow icon', () => {
    const { container } = render(<CategoryCard category={mockCategory} />);

    const arrowIcon = container.querySelector('svg path[d="M9 5l7 7-7 7"]');
    expect(arrowIcon).toBeInTheDocument();
  });
});
