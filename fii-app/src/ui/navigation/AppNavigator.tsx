import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "../screens/HomeScreen";
import FiiDetailScreen from "../screens/FiiDetailScreen";
import type { Fii } from "../../domain/models/fii";

export type RootStackParamList = {
  Home: undefined;
  FiiDetail: { fii: import("../../domain/models/fii").Fii; updatedAt?: string | null };
};


const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator id="root">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "FIIs" }} />
        <Stack.Screen
          name="FiiDetail"
          component={FiiDetailScreen}
          options={{ title: "Detalhe do FII" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
