import { router } from 'expo-router';

/**
 * Goes back if there is a previous screen, otherwise opens the home screen.
 * Needed because a screen can be opened directly (e.g. reloading the browser
 * on /listener-apply), in which case there is nothing to go back to.
 */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
