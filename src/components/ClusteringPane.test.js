import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ClusteringPane from './ClusteringPane';

// Mock data for testing
const mockPositions = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 1, z: 1 },
  { x: 0.5, y: 0.5, z: 0.5 },
  { x: 10, y: 10, z: 10 },
  { x: 11, y: 11, z: 11 },
  { x: 10.5, y: 10.5, z: 10.5 },
];

const mockBoxSize = [20, 20, 20];

const mockOnHighlightClusters = jest.fn();

describe('ClusteringPane', () => {
  beforeEach(() => {
    mockOnHighlightClusters.mockClear();
  });

  test('renders clustering pane with correct title', () => {
    render(
      <ClusteringPane
        positions={mockPositions}
        boxSize={mockBoxSize}
        onHighlightClusters={mockOnHighlightClusters}
      />
    );

    expect(screen.getByText('Particle Clustering')).toBeInTheDocument();
  });

  test('displays parameter controls', () => {
    render(
      <ClusteringPane
        positions={mockPositions}
        boxSize={mockBoxSize}
        onHighlightClusters={mockOnHighlightClusters}
      />
    );

    expect(screen.getByText(/Epsilon Distance:/)).toBeInTheDocument();
    expect(screen.getByText(/Min Points:/)).toBeInTheDocument();
  });

  test('displays statistics section', () => {
    render(
      <ClusteringPane
        positions={mockPositions}
        boxSize={mockBoxSize}
        onHighlightClusters={mockOnHighlightClusters}
      />
    );

    expect(screen.getByText('Statistics')).toBeInTheDocument();
    expect(screen.getByText('Total Clusters:')).toBeInTheDocument();
    expect(screen.getByText('Clustered Particles:')).toBeInTheDocument();
  });

  test('displays histogram section', () => {
    render(
      <ClusteringPane
        positions={mockPositions}
        boxSize={mockBoxSize}
        onHighlightClusters={mockOnHighlightClusters}
      />
    );

    expect(screen.getByText('Cluster Size Distribution')).toBeInTheDocument();
    expect(screen.getByText('Cluster Size (particles)')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
  });

  test('allows epsilon parameter adjustment', () => {
    render(
      <ClusteringPane
        positions={mockPositions}
        boxSize={mockBoxSize}
        onHighlightClusters={mockOnHighlightClusters}
      />
    );

    const epsilonSlider = screen.getByDisplayValue('2');
    fireEvent.change(epsilonSlider, { target: { value: '3.5' } });
    
    expect(screen.getByText(/Epsilon Distance: 3.50/)).toBeInTheDocument();
  });

  test('allows min points parameter adjustment', () => {
    render(
      <ClusteringPane
        positions={mockPositions}
        boxSize={mockBoxSize}
        onHighlightClusters={mockOnHighlightClusters}
      />
    );

    const minPointsSlider = screen.getByDisplayValue('3');
    fireEvent.change(minPointsSlider, { target: { value: '5' } });
    
    expect(screen.getByText(/Min Points: 5/)).toBeInTheDocument();
  });

  test('can be collapsed and expanded', () => {
    render(
      <ClusteringPane
        positions={mockPositions}
        boxSize={mockBoxSize}
        onHighlightClusters={mockOnHighlightClusters}
      />
    );

    // Close the pane
    const closeButton = screen.getByTitle('Hide Clustering Panel');
    fireEvent.click(closeButton);

    // Should show toggle button
    expect(screen.getByTitle('Show Clustering Panel')).toBeInTheDocument();
    expect(screen.queryByText('Particle Clustering')).not.toBeInTheDocument();

    // Open the pane again
    const toggleButton = screen.getByTitle('Show Clustering Panel');
    fireEvent.click(toggleButton);

    expect(screen.getByText('Particle Clustering')).toBeInTheDocument();
  });

  test('handles empty positions array', () => {
    render(
      <ClusteringPane
        positions={[]}
        boxSize={mockBoxSize}
        onHighlightClusters={mockOnHighlightClusters}
      />
    );

    expect(screen.getByText('Total Clusters:')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  test('calls onHighlightClusters when show only selected is toggled', () => {
    render(
      <ClusteringPane
        positions={mockPositions}
        boxSize={mockBoxSize}
        onHighlightClusters={mockOnHighlightClusters}
      />
    );

    const showOnlyCheckbox = screen.getByText('Show only selected clusters').previousSibling;
    fireEvent.click(showOnlyCheckbox);

    expect(mockOnHighlightClusters).toHaveBeenCalled();
  });
});
