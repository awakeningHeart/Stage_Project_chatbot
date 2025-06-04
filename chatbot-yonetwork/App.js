import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import HomeScreenNavigation from './App/navigation/HomeScreenNavigation';
import { logger } from './App/Services/logger';
import AuthStorage from './App/Services/AuthStorage';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [isSessionValid, setIsSessionValid] = useState(false);

  useEffect(() => {
    // Vérifier la session au démarrage de l'application
    const checkSession = async () => {
      try {
        logger.info('Vérification de la session au démarrage...');
        
        // Vérifier si l'utilisateur est authentifié localement
        const isAuthenticated = await AuthStorage.isAuthenticated();
        
        if (isAuthenticated) {
          logger.info('Utilisateur authentifié localement, vérification de la session serveur');
          
          // Vérifier la session serveur
          const isServerSessionValid = await AuthStorage.validateServerSession();
          
          if (!isServerSessionValid) {
            logger.warn('Session serveur invalide ou expirée, effacement des données d\'authentification');
            await AuthStorage.clearAuthData();
            setIsSessionValid(false);
          } else {
            logger.info('Session serveur valide');
            setIsSessionValid(true);
          }
        } else {
          logger.info('Utilisateur non authentifié');
          setIsSessionValid(false);
        }
      } catch (error) {
        logger.error('Erreur lors de la vérification de la session:', error);
        setIsSessionValid(false);
      } finally {
        setIsReady(true);
      }
    };

    checkSession();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <HomeScreenNavigation initialAuthenticated={isSessionValid} />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});
