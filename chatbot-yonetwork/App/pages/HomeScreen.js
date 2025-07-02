// Importation des composants nécessaires depuis React Native et des librairies utilisées
import { View, Text, FlatList, TouchableOpacity, Dimensions, ScrollView, Alert } from "react-native";
import React, { useEffect, useState } from "react";
import ChatFaceData from "../Services/ChatFaceData"; // Données statiques des avatars de chat
import { Image } from "react-native";
import { useNavigation } from "@react-navigation/native"; // Pour naviguer entre les écrans
import { createNewSession } from "../Services/GlobalApi"; // API pour créer une session de conversation
import { logger } from "../Services/logger"; // Outil de log personnalisé
import AsyncStorage from '@react-native-async-storage/async-storage'; // Stockage local
import AuthStorage from "../Services/AuthStorage"; // Service de gestion d'authentification

// Définition des styles pour la page
const styles = {
  // Conteneur principal qui occupe tout l'écran
  container: {
    flex: 1,
    // Pour un dégradé, il faut utiliser le composant <LinearGradient /> avec la prop `colors`.
    backgroundColor: '#ffffff'
  },
  // Contenu scrollable avec alignement centré et marges haut/bas
  scrollContent: {
    flexGrow: 1,              
    alignItems: "center",     
    paddingTop: 40,
    paddingBottom: 40
  },

  // Titre principal
  title: {
    color: '#0A1E3F',         
    fontSize: 30              
  },

  // Variante du titre en gras
  titleBold: {
    color: '#0A1E3F',
    fontSize: 30,
    fontWeight: 'bold'
  },

  // Image de profil ou personnage
  avatar: {
    width: 150,
    height: 150,
    borderRadius: 50,         
    marginTop: 20
  },

  // Sous-titre ou titre de section
  subtitle: {
    fontSize: 25,
    marginTop: 30,
    fontWeight: 'bold'
  },

  // Conteneur pour le visage/personnage de chat
  chatFaceContainer: {
    marginTop: 20,
    backgroundColor: '#f8f9fa', 
    alignItems: "center",
    height: 110,
    padding: 10,
    borderRadius: 20,
    width: '90%'            
  },

  // Texte sous l'image/personnage de chat
  chatFaceText: {
    fontSize: 17,
    marginTop: 5,
    color: "#B0B0B0"          
  },

  // Bouton principal pour démarrer une conversation
  chatButton: {
    marginTop: 30,
    backgroundColor: '#0A1E3F', 
    width: Dimensions.get('window').width * 0.8, 
    alignItems: "center",
    padding: 17,
    borderRadius: 100,        
    elevation: 3,            

    // Ombres sur iOS
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },

  // Texte à l'intérieur du bouton
  chatButtonText: {
    fontSize: 16,
    color: "#FFFFFF",         
    fontWeight: 'bold'
  },

  // Styles pour le debug
  debugContainer: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    margin: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc'
  },

  debugText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 5
  },

  errorContainer: {
    backgroundColor: '#ffe6e6',
    padding: 15,
    margin: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ff9999'
  },

  errorText: {
    color: '#cc0000',
    fontSize: 14,
    fontWeight: 'bold'
  }
};


// Composant principal : écran d'accueil
export default function HomeScreen() {
  // États pour gérer les données des avatars et la sélection actuelle
  const [chatFaceData, setChatFaceData] = useState([]);
  const [selectedChatFaceData, setSelectedChatFaceData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const navigation = useNavigation(); // Hook pour gérer la navigation

  useEffect(() => {
    // Initialisation au démarrage de l'écran
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        console.log('[HomeScreen] Début de l\'initialisation');
        
        // Test 1: Chargement des données des avatars
        console.log('[HomeScreen] Test 1: Chargement des données ChatFaceData');
        if (!ChatFaceData || ChatFaceData.length === 0) {
          throw new Error('Données ChatFaceData manquantes ou vides');
        }
        setChatFaceData(ChatFaceData);
        setSelectedChatFaceData(ChatFaceData[0]);
        console.log('[HomeScreen] ✓ Données ChatFaceData chargées:', ChatFaceData.length, 'éléments');

        // Test 2: Vérification de l'authentification
        console.log('[HomeScreen] Test 2: Vérification de l\'authentification');
        const isAuthenticated = await AuthStorage.isAuthenticated();
        console.log('[HomeScreen] ✓ État d\'authentification:', isAuthenticated);

        // Informations de debug
        const debug = {
          chatFaceDataCount: ChatFaceData.length,
          isAuthenticated,
          platform: require('react-native').Platform.OS,
          timestamp: new Date().toISOString()
        };

        if (isAuthenticated) {
          // Test 3: Vérification de la session existante
          console.log('[HomeScreen] Test 3: Vérification de la session existante');
          const existingSession = await AsyncStorage.getItem('conversationSessionId');
          debug.existingSession = !!existingSession;
          
          if (!existingSession) {
            console.log('[HomeScreen] Test 4: Création d\'une nouvelle session');
            // Note: Nous ne testons plus la création de session pour éviter les erreurs de connexion
            debug.sessionCreationSkipped = true;
            console.log('[HomeScreen] ℹ Création de session ignorée pour éviter les erreurs de connexion');
          } else {
            debug.existingSessionId = existingSession;
            console.log('[HomeScreen] ✓ Session existante trouvée');
          }
        } else {
          console.log('[HomeScreen] ℹ Utilisateur non authentifié, suppression des sessions');
          await AsyncStorage.removeItem('conversationSessionId');
          debug.sessionRemoved = true;
        }

        setDebugInfo(debug);
        console.log('[HomeScreen] ✓ Initialisation complète réussie');
        
      } catch (error) {
        console.error('[HomeScreen] ❌ Erreur lors de l\'initialisation:', error);
        setError(error.message);
        
        // Essayer de charger au moins les données de base
        try {
          if (ChatFaceData && ChatFaceData.length > 0) {
            setChatFaceData(ChatFaceData);
            setSelectedChatFaceData(ChatFaceData[0]);
            console.log('[HomeScreen] ⚠ Chargement de récupération des données réussi');
          }
        } catch (fallbackError) {
          console.error('[HomeScreen] ❌ Échec du chargement de récupération:', fallbackError);
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Exécution des fonctions d'initialisation
    initializeApp();
  }, []);

  // Fonction appelée lorsqu'on sélectionne un autre avatar
  const onChatFacePress = (id) => {
    try {
      const selectedChatFace = chatFaceData.find((item) => item.id === id);
      if (selectedChatFace) {
        setSelectedChatFaceData(selectedChatFace);
        console.log('[HomeScreen] Avatar sélectionné:', selectedChatFace.name);
      }
    } catch (error) {
      console.error('[HomeScreen] Erreur lors de la sélection d\'avatar:', error);
    }
  }

  // Affichage de chargement
  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.title}>Chargement...</Text>
        <Text style={styles.chatFaceText}>Initialisation de l'application</Text>
      </View>
    );
  }

  // Affichage d'erreur avec informations de debug
  if (error) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Erreur détectée:</Text>
          <Text style={styles.debugText}>{error}</Text>
        </View>
        
        <View style={styles.debugContainer}>
          <Text style={[styles.debugText, { fontWeight: 'bold' }]}>Informations de debug:</Text>
          <Text style={styles.debugText}>Platform: {require('react-native').Platform.OS}</Text>
          <Text style={styles.debugText}>ChatFaceData: {chatFaceData.length} éléments</Text>
          <Text style={styles.debugText}>Sélection: {selectedChatFaceData ? selectedChatFaceData.name : 'Aucune'}</Text>
        </View>

        {selectedChatFaceData && (
          <View style={styles.scrollContent}>
            <Text style={styles.titleBold}>Mode de récupération activé</Text>
            <Text style={styles.title}>L'application fonctionne partiellement</Text>
            <Image
              source={{ uri: selectedChatFaceData.image }}
              style={styles.avatar}
              onError={(e) => console.error('Erreur de chargement d\'image:', e.nativeEvent.error)}
            />
            <TouchableOpacity 
              onPress={() => {
                try {
                  navigation.navigate('Login', {
                    selectedFace: selectedChatFaceData,
                    fromScreen: 'Home'
                  });
                } catch (navError) {
                  Alert.alert('Erreur de navigation', navError.message);
                }
              }}
              style={styles.chatButton}
            >
              <Text style={styles.chatButtonText}>Continuer malgré l'erreur</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  }

  // Si les données ne sont pas prêtes
  if (!selectedChatFaceData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.title}>Aucune donnée disponible</Text>
        <Text style={styles.chatFaceText}>Veuillez redémarrer l'application</Text>
      </View>
    );
  }

  // Rendu principal de l'écran
  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Affichage debug en développement */}
      {__DEV__ && Object.keys(debugInfo).length > 0 && (
        <View style={styles.debugContainer}>
          <Text style={[styles.debugText, { fontWeight: 'bold' }]}>Debug Info:</Text>
          {Object.entries(debugInfo).map(([key, value]) => (
            <Text key={key} style={styles.debugText}>
              {key}: {String(value)}
            </Text>
          ))}
        </View>
      )}

      {/* Texte d'accueil */}
      <Text style={styles.titleBold}>Salut, c'est moi {selectedChatFaceData.name}</Text>
      <Text style={styles.title}>Dis-moi ce que tu veux, je m'occupe du reste.</Text>
      
      {/* Image de l'avatar sélectionné */}
      <Image
        source={{ uri: selectedChatFaceData.image }}
        style={styles.avatar}
        onError={(e) => {
          console.error('Erreur de chargement d\'image:', e.nativeEvent.error);
          Alert.alert('Erreur', 'Impossible de charger l\'image de l\'avatar');
        }}
      />
      <Text style={styles.chatFaceText}>Choisissez votre SoukBuddy préféré</Text>
      

      {/* Conteneur pour changer d'avatar */}
      <View style={styles.chatFaceContainer}> 
        <FlatList
          data={chatFaceData}
          horizontal={true}
          renderItem={({ item }) =>
            selectedChatFaceData.id !== item.id && (
              <TouchableOpacity 
                style={{ margin: 15 }} 
                onPress={() => onChatFacePress(item.id)}
              >
                <Image 
                  source={{ uri: item.image }} 
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                  onError={(e) => console.warn('Erreur image miniature:', e.nativeEvent.error)}
                />
              </TouchableOpacity>
            )
          }
          keyExtractor={(item) => item.id.toString()}
        />
        
      </View>
      <Text style={styles.subtitle}>Explorez, discuter, acheter</Text>
      
      {/* Bouton pour commencer une conversation */}
      <TouchableOpacity 
        onPress={() => {
          try {
            logger.info('[HomeScreen] Navigation vers Login avec le chat face sélectionné:', selectedChatFaceData);
            navigation.navigate('Login', {
              selectedFace: selectedChatFaceData,
              fromScreen: 'Home'
            });
          } catch (error) {
            console.error('[HomeScreen] Erreur de navigation:', error);
            Alert.alert('Erreur de navigation', error.message);
          }
        }}
        style={styles.chatButton}
      >
        <Text style={styles.chatButtonText}>👇 Clique et parle-lui !</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
