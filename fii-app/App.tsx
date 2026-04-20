import React from "react";
import AppNavigator from "./src/ui/navigation/AppNavigator";
import { configureNotificationHandler } from "./src/data/services/notificationService";

export default function App() {
  configureNotificationHandler();
  return <AppNavigator />;
}
