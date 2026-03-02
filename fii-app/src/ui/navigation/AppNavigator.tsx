import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import type { Fii } from "../../domain/models/fii";
import type { MarketAsset } from "../../domain/models/marketAsset";
import HomeScreen from "../screens/HomeScreen";
import FiiDetailScreen from "../screens/FiiDetailScreen";
import MarketAssetDetailScreen from "../screens/MarketAssetDetailScreen";
import PortfolioListScreen from "../screens/PortfolioListScreen";
import PortfolioFormScreen from "../screens/PortfolioFormScreen";
import PortfolioDetailScreen from "../screens/PortfolioDetailScreen";
import AccountScreen from "../screens/AccountScreen";

type MainTabParamList = {
  MarketTab: undefined;
  PortfoliosTab: undefined;
  AccountTab: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
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
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabsNavigator() {
  return (
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
        name="AccountTab"
        component={AccountScreen}
        options={{ title: "Conta", tabBarLabel: "Conta" }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
