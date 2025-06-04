import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../pages/HomeScreen';
import React, { useEffect, useState } from 'react';
import ChatScreen from '../pages/ChatScreen';
import LoginScreen from '../pages/LoginScreen';
import RegisterScreen from '../pages/RegisterScreen';
import VerifyEmailScreen from '../pages/VerifyEmailScreen';
import AuthScreen from '../pages/AuthScreen';
import { logger } from '../Services/logger';

const Stack = createNativeStackNavigator();

export default function HomeScreenNavigation({ initialAuthenticated = false }) {
    const [isAuthenticated, setIsAuthenticated] = useState(initialAuthenticated);
    
    useEffect(() => {
        logger.info(`État d'authentification initial: ${initialAuthenticated}`);
        setIsAuthenticated(initialAuthenticated);
    }, [initialAuthenticated]);
    
    return (
        <Stack.Navigator 
            initialRouteName={isAuthenticated ? "Chat" : "Home"}
            screenOptions={{ 
                headerShown: false,
                animation: 'slide_from_right'
            }}
        >
            <Stack.Screen 
                name="Home" 
                component={HomeScreen}
                options={{
                    gestureEnabled: false
                }}
            />
            <Stack.Screen 
                name="Login" 
                component={LoginScreen}
                options={{
                    gestureEnabled: true
                }}
            />
            <Stack.Screen 
                name="Auth" 
                component={AuthScreen}
                options={{
                    gestureEnabled: true
                }}
            />
            <Stack.Screen 
                name="Register" 
                component={RegisterScreen}
                options={{
                    gestureEnabled: true
                }}
            />
            <Stack.Screen 
                name="Chat" 
                component={ChatScreen}
                options={{
                    gestureEnabled: true
                }}
            />
            <Stack.Screen 
                name="VerifyEmail" 
                component={VerifyEmailScreen}
                options={{
                    gestureEnabled: false,
                    animation: 'fade'
                }}
            />
        </Stack.Navigator>
    );
}
