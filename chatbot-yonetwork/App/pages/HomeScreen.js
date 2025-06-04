import { View, Text, FlatList, TouchableOpacity, Dimensions, ScrollView } from "react-native";
import React, {useEffect ,useState} from "react";
import  ChatFaceData  from "../Services/ChatFaceData";  
import { Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { createNewSession } from "../Services/GlobalApi";
import { logger } from "../Services/logger";
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthStorage from "../Services/AuthStorage";

// Styles constants pour maintenir la cohérence
const styles = {
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 40
  },
  title: {
    color: '#2E7D32',
    fontSize: 30
  },
  titleBold: {
    color: '#2E7D32',
    fontSize: 30,
    fontWeight: 'bold'
  },
  avatar: {
    width: 150,
    height: 150,
    borderRadius: 50,
    marginTop: 20
  },
  subtitle: {
    fontSize: 25,
    marginTop: 30,
    fontWeight: 'bold'
  },
  chatFaceContainer: {
    marginTop: 20,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    height: 110,
    padding: 10,
    borderRadius: 20,
    width: '90%'
  },
  chatFaceText: {
    fontSize: 17,
    marginTop: 5,
    color: "#B0B0B0"
  },
  chatButton: {
    marginTop: 30,
    backgroundColor: '#2E7D32',
    width: Dimensions.get('window').width * 0.8,
    alignItems: "center",
    padding: 17,
    borderRadius: 100,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  chatButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: 'bold'
  }
};

export default function HomeScreen() {
  const [chatFaceData, setChatFaceData] = useState([]);
  const [selectedChatFaceData, setSelectedChatFaceData] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Vérifier si l'utilisateur est authentifié
        const isAuthenticated = await AuthStorage.isAuthenticated();
        
        if (isAuthenticated) {
          // Vérifier si une session de conversation existe déjà
          const existingSession = await AsyncStorage.getItem('conversationSessionId');
        if (!existingSession) {
            logger.info('[HomeScreen] Utilisateur authentifié, création d\'une nouvelle session de conversation');
          const newSessionId = await createNewSession();
          if (newSessionId) {
            logger.info('[HomeScreen] Nouvelle session créée avec succès');
          } else {
            logger.error('[HomeScreen] Échec de la création de session');
          }
        } else {
            logger.info('[HomeScreen] Session de conversation existante trouvée');
          }
        } else {
          logger.info('[HomeScreen] Utilisateur non authentifié, pas de création de session');
          // Supprimer toute session existante si l'utilisateur n'est plus authentifié
          await AsyncStorage.removeItem('conversationSessionId');
        }
      } catch (error) {
        logger.error('[HomeScreen] Erreur lors de l\'initialisation:', error);
      }
    };

    initializeApp();
    setChatFaceData(ChatFaceData);
    setSelectedChatFaceData(ChatFaceData[0]);
  }, []);

  const onChatFacePress = (id) => {
    const selectedChatFace = chatFaceData.find((item) => item.id === id);
    setSelectedChatFaceData(selectedChatFace);
  }

  if (!selectedChatFaceData) {
    return (
      <View style={styles.container}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Hello</Text>
      <Text style={styles.titleBold}>I am {selectedChatFaceData.name}</Text>
      
      <Image
        source={{uri: selectedChatFaceData.image}}
        style={styles.avatar}
      />
      <Text style={styles.subtitle}>How can I help you?</Text>
       
      <View style={styles.chatFaceContainer}> 
        <FlatList
          data={chatFaceData}
          horizontal={true}
          renderItem={({ item }) => selectedChatFaceData.id != item.id && (
            <TouchableOpacity 
              style={{ margin: 15 }} 
              onPress={() => onChatFacePress(item.id)}
            >
              <Image 
                source={{uri: item.image}} 
                style={{width: 40, height: 40, borderRadius: 20}}
              />
            </TouchableOpacity>
          )}
        />
        <Text style={styles.chatFaceText}>Choose your Favorite ChatBuddy</Text>
      </View>

      <TouchableOpacity 
        onPress={() => {
          logger.info('[HomeScreen] Navigation vers Login avec le chat face sélectionné:', selectedChatFaceData);
          navigation.navigate('Login', {
            selectedFace: selectedChatFaceData,
            fromScreen: 'Home'
          });
        }}
        style={styles.chatButton}
      >
        <Text style={styles.chatButtonText}>Let's Chat</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}