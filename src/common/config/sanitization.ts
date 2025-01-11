import { stripHtml } from 'string-strip-html';

export const sanitizeString = (str: string): string => {
  if (typeof str !== 'string') return str;

  // Remove HTML tags
  str = stripHtml(str).result;

  // Remove SQL injection patterns
  str = str.replace(/['";]/g, '');

  // Remove script tags e eventos
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  str = str.replace(/on\w+="[^"]*"/g, '');

  // Trim whitespace
  str = str.trim();

  return str;
};

export const sanitizeObject = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc: any, key) => {
      acc[key] = sanitizeObject(obj[key]);
      return acc;
    }, {});
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  return obj;
};
