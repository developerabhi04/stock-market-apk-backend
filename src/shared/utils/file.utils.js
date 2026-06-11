import fs from 'fs';

export const removeLocalFile = (filePath) => {
  if (!filePath) return;

  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Failed to delete file:', err.message);
    }
  });
};