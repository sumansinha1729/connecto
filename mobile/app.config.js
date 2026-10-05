const fs = require('node:fs');
const path = require('node:path');

/**
 * Settings live in app.json; this only adds Firebase (phone login) to the Android build
 * once google-services.json is in this folder (Firebase console → Project settings → Android app).
 * Without the file the app still builds, and login uses the dev codes from our own server.
 */
const GOOGLE_SERVICES = './google-services.json';

module.exports = ({ config }) => {
  if (!fs.existsSync(path.join(__dirname, GOOGLE_SERVICES))) return config;
  return {
    ...config,
    android: { ...config.android, googleServicesFile: GOOGLE_SERVICES },
    plugins: [...config.plugins, '@react-native-firebase/app', '@react-native-firebase/auth'],
  };
};
