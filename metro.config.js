const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add web platform
config.resolver.platforms = ['ios', 'android', 'web'];

module.exports = config;