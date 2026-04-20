import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "app:onboarding:v1:dismissed";

export async function isOnboardingDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function dismissOnboarding(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // ignore persistence errors
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // ignore persistence errors
  }
}
