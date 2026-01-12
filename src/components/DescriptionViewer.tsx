'use client';

import { Streamdown } from 'streamdown';

interface DescriptionViewerProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content using streamdown library.
 * Designed for displaying ticket descriptions with full markdown support.
 */
export function DescriptionViewer({
  content,
  className,
}: DescriptionViewerProps) {
  if (!content) {
    return null;
  }

  return (
    <div className={className}>
      <Streamdown>{content}</Streamdown>
    </div>
  );
}
