export * from './image';

if (typeof Bun === 'undefined') {
  throw new Error('This library is made for Bun.');
}