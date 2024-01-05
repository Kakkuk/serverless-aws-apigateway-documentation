'use strict';

module.exports = {
  getFileExtension: function (filename) {
    const path = require('path');
    return path.extname(filename || '').split('.').slice(-1)[0];
  },

  isYamlFileExtension: function (extension) {
    return extension === 'yml' || extension === 'yaml';
  },
};

