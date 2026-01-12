import { describe, it, expect } from 'vitest';
import {
  encodeProjectPath,
  decodeProjectPath,
  isValidEncodedPath,
  buildProjectUrl,
} from './project-path';

describe('project-path', () => {
  describe('encodeProjectPath', () => {
    it('encodes a simple path', () => {
      const path = '/home/user/project';
      const encoded = encodeProjectPath(path);
      expect(encoded).toBe('L2hvbWUvdXNlci9wcm9qZWN0');
    });

    it('produces URL-safe characters (no +, /, or =)', () => {
      // Path that would produce + and / in regular base64
      const path = '/path/with/special?chars&more';
      const encoded = encodeProjectPath(path);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });

    it('handles paths with spaces', () => {
      const path = '/home/user/my project';
      const encoded = encodeProjectPath(path);
      const decoded = decodeProjectPath(encoded);
      expect(decoded).toBe(path);
    });

    it('handles unicode characters', () => {
      const path = '/home/用户/项目';
      const encoded = encodeProjectPath(path);
      const decoded = decodeProjectPath(encoded);
      expect(decoded).toBe(path);
    });
  });

  describe('decodeProjectPath', () => {
    it('decodes an encoded path', () => {
      const encoded = 'L2hvbWUvdXNlci9wcm9qZWN0';
      const decoded = decodeProjectPath(encoded);
      expect(decoded).toBe('/home/user/project');
    });

    it('handles missing padding', () => {
      // base64url removes padding, decoder should add it back
      const path = '/test';
      const encoded = encodeProjectPath(path);
      const decoded = decodeProjectPath(encoded);
      expect(decoded).toBe(path);
    });

    it('roundtrips correctly', () => {
      const paths = [
        '/',
        '/home',
        '/home/user',
        '/home/user/projects/my-app',
        '/mnt/data/workspace',
        '/Users/name/Documents/code',
      ];

      for (const path of paths) {
        const encoded = encodeProjectPath(path);
        const decoded = decodeProjectPath(encoded);
        expect(decoded).toBe(path);
      }
    });
  });

  describe('isValidEncodedPath', () => {
    it('returns true for valid encoded paths', () => {
      const path = '/home/user/project';
      const encoded = encodeProjectPath(path);
      expect(isValidEncodedPath(encoded)).toBe(true);
    });

    it('returns false for non-base64url characters', () => {
      expect(isValidEncodedPath('abc+def')).toBe(false);
      expect(isValidEncodedPath('abc/def')).toBe(false);
      expect(isValidEncodedPath('abc=def')).toBe(false);
      expect(isValidEncodedPath('abc def')).toBe(false);
    });

    it('returns false for paths that do not start with /', () => {
      // Encode a relative path
      const encoded = Buffer.from('relative/path', 'utf-8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      expect(isValidEncodedPath(encoded)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidEncodedPath('')).toBe(false);
    });

    it('returns false for invalid base64', () => {
      // This would throw on decode
      expect(isValidEncodedPath('!!!')).toBe(false);
    });
  });

  describe('buildProjectUrl', () => {
    it('builds correct URL', () => {
      const path = '/home/user/project';
      const url = buildProjectUrl(path);
      expect(url).toBe('/project/L2hvbWUvdXNlci9wcm9qZWN0');
    });

    it('produces URL-safe result', () => {
      const path = '/path/with/many/segments/and/more';
      const url = buildProjectUrl(path);
      // URL should not contain characters that need encoding
      expect(url).not.toContain('+');
      expect(url).not.toContain('=');
      // Only contains expected characters
      expect(url).toMatch(/^\/project\/[A-Za-z0-9_-]+$/);
    });
  });
});
