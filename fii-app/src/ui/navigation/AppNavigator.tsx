import React, { useCallback, useEffect, useState } from "react";
import {
  NavigationContainer,
  createNavigationContainerRef,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { AppState, Linking } from "react-native";

import type { Fii } from "../../domain/models/fii";
import type { MarketAsset } from "../../domain/models/marketAsset";
import HomeScreen from "../screens/HomeScreen";
import FiiDetailScreen from "../screens/FiiDetailScreen";
import MarketAssetDetailScreen from "../screens/MarketAssetDetailScreen";
import PortfolioListScreen from "../screens/PortfolioListScreen";
import PortfolioFormScreen from "../screens/PortfolioFormScreen";
import PortfolioDetailScreen from "../screens/PortfolioDetailScreen";
import AccountScreen from "../screens/AccountScreen";
import LoginScreen from "../screens/LoginScreen";
import SignUpScreen from "../screens/SignUpScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import DividendCalendarScreen from "../screens/DividendCalendarScreen";
import CoursesScreen from "../screens/CoursesScreen";
import HelpScreen from "../screens/HelpScreen";
import EventsFeedScreen from "../screens/EventsFeedScreen";
import PoliciesScreen from "../screens/PoliciesScreen";
import FirstAccessTour from "../components/FirstAccessTour";
import PolicyAcceptancePrompt from "../components/PolicyAcceptancePrompt";
import {
  dismissOnboarding,
  isOnboardingDismissed,
} from "../../data/services/onboardingService";
import {
  consumePasswordResetUrl,
  CURRENT_POLICY_VERSION,
  getSupabaseSessionUser,
  isSupabaseConfigured,
  persistCurrentUserPolicyAcceptance,
  subscribeToSupabaseAuthChanges,
} from "../../data/services/supabase/client";

type MainTabParamList = {
  MarketTab: undefined;
  CalendarTab: undefined;
  CoursesTab: undefined;
  PortfoliosTab: undefined;
  AccountTab: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  FiiDetail: {
    fii: Fii;
    updatedAt?: string | null;
    fundamentalsUpdatedAt?: string | null;
  };
  MarketAssetDetail: {
    asset: MarketAsset;
  };
  PortfolioForm: {
    portfolioId?: string;
  };
  PortfolioDetail: {
    portfolioId: string;
    readOnly?: boolean;
  };
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword:
    | {
        invalidLink?: boolean;
        message?: string;
      }
    | undefined;
  EventsFeed:
    | {
        query?: string;
      }
    | undefined;
  Help: undefined;
  Policies: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function MainTabsNavigator() {
  const [tourVisible, setTourVisible] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const dismissed = await isOnboardingDismissed();
      if (!active || dismissed) return;
      setTourVisible(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleFinishTour() {
    await dismissOnboarding();
    setTourVisible(false);
  }

  return (
    <>
      <Tab.Navigator
        id="main-tabs"
        initialRouteName="MarketTab"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: "#111",
          tabBarInactiveTintColor: "#888",
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700", paddingBottom: 2 },
          tabBarStyle: {
            backgroundColor: "#ffffff",
            borderTopWidth: 0,
            height: 66,
            paddingTop: 8,
            paddingBottom: 8,
            elevation: 10,
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: -2 },
          },
          tabBarIcon: ({ color, size, focused }) => {
            if (route.name === "MarketTab") {
              return (
                <Ionicons
                  name={focused ? "analytics" : "analytics-outline"}
                  size={size}
                  color={color}
                />
              );
            }

            if (route.name === "PortfoliosTab") {
              return (
                <Ionicons
                  name={focused ? "briefcase" : "briefcase-outline"}
                  size={size}
                  color={color}
                />
              );
            }

            if (route.name === "CalendarTab") {
              return (
                <Ionicons
                  name={focused ? "calendar" : "calendar-outline"}
                  size={size}
                  color={color}
                />
              );
            }

            if (route.name === "CoursesTab") {
              return (
                <Ionicons
                  name={focused ? "school" : "school-outline"}
                  size={size}
                  color={color}
                />
              );
            }

            return (
              <Ionicons
                name={focused ? "person-circle" : "person-circle-outline"}
                size={size}
                color={color}
              />
            );
          },
        })}
      >
        <Tab.Screen
          name="MarketTab"
          component={HomeScreen}
          options={{ title: "Mercado", tabBarLabel: "Mercado" }}
        />
        <Tab.Screen
          name="PortfoliosTab"
          component={PortfolioListScreen}
          options={{ title: "Carteiras", tabBarLabel: "Carteiras" }}
        />
        <Tab.Screen
          name="CalendarTab"
          component={DividendCalendarScreen}
          options={{ title: "Agenda", tabBarLabel: "Agenda" }}
        />
        <Tab.Screen
          name="CoursesTab"
          component={CoursesScreen}
          options={{ title: "Cursos", tabBarLabel: "Cursos" }}
        />
        <Tab.Screen
          name="AccountTab"
          component={AccountScreen}
          options={{ title: "Conta", tabBarLabel: "Conta" }}
        />
      </Tab.Navigator>

      <FirstAccessTour visible={tourVisible} onFinish={handleFinishTour} />
    </>
  );
}

export default function AppNavigator() {
  const configured = isSupabaseConfigured();
  const [policyPromptVisible, setPolicyPromptVisible] = useState(false);
  const [policyPromptBusy, setPolicyPromptBusy] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [pendingResetRoute, setPendingResetRoute] = useState<
    RootStackParamList["ResetPassword"] | null
  >(null);

  const refreshPolicyPrompt = useCallback(async () => {
    if (!configured) {
      setPolicyPromptVisible(false);
      return;
    }

    const user = await getSupabaseSessionUser();
    const requiresPrompt = Boolean(
      user && !user.isAnonymous && user.email && user.policyVersion !== CURRENT_POLICY_VERSION
    );

    if (!requiresPrompt) {
      setDismissedVersion(null);
      setPolicyPromptVisible(false);
      return;
    }

    setPolicyPromptVisible(dismissedVersion !== CURRENT_POLICY_VERSION);
  }, [configured, dismissedVersion]);

  useEffect(() => {
    void refreshPolicyPrompt();

    const unsubscribeAuth = subscribeToSupabaseAuthChanges(() => {
      void refreshPolicyPrompt();
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshPolicyPrompt();
      }
    });

    return () => {
      unsubscribeAuth();
      appStateSubscription.remove();
    };
  }, [refreshPolicyPrompt]);

  useEffect(() => {
    async function handleIncomingUrl(url: string | null | undefined) {
      const normalizedUrl = String(url ?? "").trim();
      if (!normalizedUrl) return;

      const result = await consumePasswordResetUrl(normalizedUrl);
      if (!result.isRecoveryLink) return;
      const params = {
        invalidLink: !result.ok,
        message: result.message,
      };

      if (!navigationRef.isReady()) {
        setPendingResetRoute(params);
        return;
      }

      navigationRef.navigate("ResetPassword", params);
    }

    void Linking.getInitialURL().then((url) => {
      void handleIncomingUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleIncomingUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!pendingResetRoute || !navigationRef.isReady()) return;
    navigationRef.navigate("ResetPassword", pendingResetRoute);
    setPendingResetRoute(null);
  }, [pendingResetRoute]);

  async function handleAcceptPolicyPrompt() {
    setPolicyPromptBusy(true);
    const result = await persistCurrentUserPolicyAcceptance({
      source: "PROFILE_CONFIRMATION",
    });
    if (result.ok) {
      setDismissedVersion(null);
      setPolicyPromptVisible(false);
    }
    setPolicyPromptBusy(false);
    await refreshPolicyPrompt();
  }

  function handleReviewPolicies() {
    setPolicyPromptVisible(false);
    if (navigationRef.isReady()) {
      navigationRef.navigate("Policies");
    }
  }

  function handleDismissPolicyPrompt() {
    setDismissedVersion(CURRENT_POLICY_VERSION);
    setPolicyPromptVisible(false);
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (pendingResetRoute) {
          navigationRef.navigate("ResetPassword", pendingResetRoute);
          setPendingResetRoute(null);
        }
      }}
    >
      <>
        <Stack.Navigator id="root-stack">
          <Stack.Screen
            name="MainTabs"
            component={MainTabsNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="FiiDetail"
            component={FiiDetailScreen}
            options={{ title: "Detalhe" }}
          />
          <Stack.Screen
            name="MarketAssetDetail"
            component={MarketAssetDetailScreen}
            options={{ title: "Análise do ativo" }}
          />
          <Stack.Screen
            name="PortfolioForm"
            component={PortfolioFormScreen}
            options={{ title: "Montar carteira" }}
          />
          <Stack.Screen
            name="PortfolioDetail"
            component={PortfolioDetailScreen}
            options={{ title: "Detalhe da carteira" }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: "Entrar" }}
          />
          <Stack.Screen
            name="SignUp"
            component={SignUpScreen}
            options={{ title: "Criar conta" }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ title: "Recuperar senha" }}
          />
          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{ title: "Nova senha" }}
          />
          <Stack.Screen
            name="EventsFeed"
            component={EventsFeedScreen}
            options={{ title: "Eventos oficiais" }}
          />
          <Stack.Screen
            name="Help"
            component={HelpScreen}
            options={{ title: "Ajuda" }}
          />
          <Stack.Screen
            name="Policies"
            component={PoliciesScreen}
            options={{ title: "Termos e privacidade" }}
          />
        </Stack.Navigator>

        <PolicyAcceptancePrompt
          visible={policyPromptVisible}
          busy={policyPromptBusy}
          version={CURRENT_POLICY_VERSION}
          onReview={handleReviewPolicies}
          onAccept={() => void handleAcceptPolicyPrompt()}
          onDismiss={handleDismissPolicyPrompt}
        />
      </>
    </NavigationContainer>
  );
}
