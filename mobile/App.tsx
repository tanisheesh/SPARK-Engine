/* SPARK Mobile - remote session client for SPARK Desktop.

   Auth gate, fonts, navigation. Nothing else belongs at this level. */

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
} from '@expo-google-fonts/instrument-sans';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';

import { SessionProvider, useSession } from './src/state/SessionProvider';
import { AccountScreen } from './src/screens/AccountScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { ConversationScreen } from './src/screens/ConversationScreen';
import { ConversationsScreen } from './src/screens/ConversationsScreen';
import type { RootStackParams } from './src/navigation';
import { color } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParams>();

/* The navigator paints its own background behind screens; without this the
   default light theme flashes white on every push. */
const navTheme: Theme = {
  dark: true,
  colors: {
    primary: color.accent,
    background: color.bg,
    card: color.bg,
    text: color.ink,
    border: color.line,
    notification: color.accent,
  },
  fonts: {
    regular: { fontFamily: 'InstrumentSans', fontWeight: '400' },
    medium: { fontFamily: 'InstrumentSans_Medium', fontWeight: '500' },
    bold: { fontFamily: 'InstrumentSans_Medium', fontWeight: '600' },
    heavy: { fontFamily: 'InstrumentSans_Medium', fontWeight: '700' },
  },
};

function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={color.accent} />
    </View>
  );
}

function Routes() {
  const { ready, session } = useSession();

  if (!ready) return <Loading />;
  if (!session) return <AuthScreen />;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        // Headers are drawn inside each screen so they can carry the dataset
        // name in mono under the title, which a stock header cannot do.
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}
      >
        <Stack.Screen name="Conversations" component={ConversationsScreen} />
        <Stack.Screen name="Conversation" component={ConversationScreen} />
        <Stack.Screen name="Account" component={AccountScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans: InstrumentSans_400Regular,
    InstrumentSans_Medium: InstrumentSans_500Medium,
    IBMPlexMono: IBMPlexMono_400Regular,
  });

  // A failed font download must not block the app - the theme's platform
  // fallbacks are deliberately usable on their own.
  if (!fontsLoaded && !fontError) return <Loading />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={color.bg} />
      <SessionProvider>
        <Routes />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
