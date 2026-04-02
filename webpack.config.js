const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Fix for AssetRegistry issue - add alias
  config.resolve.alias = {
    ...config.resolve.alias,
    'react-native/Libraries/Image/AssetRegistry$': require.resolve('react-native-web/dist/modules/AssetRegistry'),
  };
  
  return config;
};