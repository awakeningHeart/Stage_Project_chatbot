import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Alert, ActivityIndicator, TouchableOpacity, Text, Animated, ScrollView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { GiftedChat, Bubble, Send, InputToolbar, Composer } from 'react-native-gifted-chat';
import { getBard } from '../Services/GlobalApi';
import { API_CONFIG } from '../Services/constants';
import { conversationHistory } from '../Services/ConversationHistory';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import ChatFaceData from '../Services/ChatFaceData';
import Sidebar from '../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Questions rapides prédéfinies
const QUICK_QUESTIONS = [
    { id: 1, text: '📍 Où nous trouver ?', icon: 'location-on' },
    { id: 2, text: '⏰ Horaires d\'ouverture', icon: 'access-time' },
    { id: 3, text: '📞 Nous contacter', icon: 'phone' },
    { id: 4, text: '💼 Nos services', icon: 'business' }
];

const SIDEBAR_WIDTH = 280;
const SCREEN_WIDTH = Dimensions.get('window').width;

const ChatScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const [selectedFace, setSelectedFace] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [isConnected, setIsConnected] = useState(true);
    const [showWelcome, setShowWelcome] = useState(true);
    const fadeAnim = new Animated.Value(0);
    const [isSidebarVisible, setIsSidebarVisible] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [isRequestInProgress, setIsRequestInProgress] = useState(false);
    const abortControllerRef = useRef(null);
    
    // Animation pour la largeur du contenu principal
    const contentWidth = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
    
    // Animation pour le bouton de menu
    const menuButtonOpacity = React.useRef(new Animated.Value(1)).current;

    // Gérer l'affichage/masquage de la sidebar avec animation
    const toggleSidebar = (visible) => {
        setIsSidebarVisible(visible);
        Animated.timing(contentWidth, {
            toValue: visible ? SCREEN_WIDTH - SIDEBAR_WIDTH : SCREEN_WIDTH,
            duration: 300,
            useNativeDriver: false,
        }).start();
        
        // Animer l'opacité du bouton
        Animated.timing(menuButtonOpacity, {
            toValue: visible ? 0 : 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    };

    // Vérification des paramètres de route et initialisation
    useEffect(() => {
        const initializeChat = async () => {
            try {
                // Vérifier si on a un ID de conversation dans les paramètres
                if (route.params?.conversationId) {
                    setConversationId(route.params.conversationId);
                    setShowWelcome(false); // Ne pas afficher le message de bienvenue pour une conversation existante
                    
                    // Charger l'historique de la conversation
                    await loadConversationHistory(route.params.conversationId);
                }
                
                if (route.params?.selectedFace) {
                    setSelectedFace(route.params.selectedFace);
                } else {
                    const defaultFace = ChatFaceData[0];
                    setSelectedFace(defaultFace);
                    console.log('Utilisation du chatbot par défaut:', defaultFace);
                }
            } catch (error) {
                console.error('Erreur lors de l\'initialisation du chat:', error);
                Alert.alert(
                    'Erreur',
                    'Impossible de charger le chat. Retour à l\'écran d\'accueil.',
                    [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
                );
            }
        };

        initializeChat();
    }, [route.params, navigation]);

    // Vérification de la connexion internet
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsConnected(state.isConnected);
            if (!state.isConnected) {
                showConnectionAlert();
            }
        });

        return () => unsubscribe();
    }, []);

    // Animation pour l'indicateur de connexion
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: isConnected ? 0 : 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, [isConnected, fadeAnim]);

    // Vérification de la configuration
    useEffect(() => {
        console.log('=== Configuration Check ===');
        console.log('Environment API URL:', process.env.EXPO_PUBLIC_API_URL);
        console.log('API_CONFIG:', API_CONFIG);
        console.log('Selected Face:', selectedFace);
        
        const handleConversationReset = async () => {
            // Vérifier si on doit créer une nouvelle conversation
            if (route.params?.resetConversation) {
                console.log('Création d\'une nouvelle conversation demandée');
                
                // Sauvegarder l'historique actuel avant de le réinitialiser
                // Cette étape est optionnelle mais permet de conserver l'historique pour référence future
                if (conversationId) {
                    try {
                        // Ici, on pourrait sauvegarder l'historique actuel dans une autre structure
                        console.log('Sauvegarde de l\'historique de la conversation précédente:', conversationId);
                    } catch (error) {
                        console.error('Erreur lors de la sauvegarde de l\'historique:', error);
                    }
                }
                
                // Réinitialiser l'ID de conversation et l'historique
                await conversationHistory.clear();
                setConversationId(null);
                setMessages([]); // Effacer les messages affichés
                setShowWelcome(true); // Afficher le message de bienvenue
                
                // Afficher un message initial pour la nouvelle conversation
                const initialMessage = {
                    _id: 1,
                    text: `Bonjour ! Je suis ${selectedFace?.name || 'Assistant'}. Comment puis-je vous aider avec cette nouvelle conversation ?`,
                    createdAt: new Date(),
                    user: {
                        _id: 2,
                        name: selectedFace?.name || 'Assistant',
                        avatar: selectedFace?.image,
                    },
                };
                setMessages([initialMessage]);
                
                console.log('Nouvelle conversation initialisée avec succès');
            }
            // Si on a un ID de conversation spécifique, charger cette conversation
            else if (route.params?.conversationId) {
                console.log('Chargement d\'une conversation existante:', route.params.conversationId);
                // Ne pas effacer l'historique, car on va charger une conversation spécifique
            }
            // Si on n'a ni resetConversation ni conversationId, c'est une nouvelle session
            else if (!route.params?.conversationId) {
                console.log('Nouvelle session, réinitialisation de l\'historique');
                await conversationHistory.clear();
            }
        };
        
        handleConversationReset();
    }, [selectedFace, route.params, setMessages, setShowWelcome]);

    // Initialisation du message de bienvenue
    useEffect(() => {
        // Ne pas afficher le message de bienvenue si on a déjà chargé une conversation
        // sauf si on a explicitement demandé une nouvelle conversation
        const shouldShowWelcome = 
            (selectedFace && !route.params?.conversationId && messages.length === 0) ||
            route.params?.resetConversation;
            
        if (shouldShowWelcome && messages.length === 0) {
        console.log('Écran de discussion monté avec selectedFace :', selectedFace);
            const initialMessage = {
                _id: 1,
                text: `Hello! I'm ${selectedFace?.name || 'Assistant'}. Comment puis-je t'aider?`,
                createdAt: new Date(),
                user: {
                    _id: 2,
                    name: selectedFace?.name || 'Assistant',
                    avatar: selectedFace?.image,
                },
            };
            console.log('Définition du message initial :', initialMessage);
            setMessages([initialMessage]);
        }
    }, [selectedFace, route.params, messages.length]);

    const showConnectionAlert = useCallback(() => {
        Alert.alert(
            'Connexion perdue',
            'Veuillez vérifier votre connexion internet',
            [{ text: 'OK' }]
        );
    }, []);

    // Fonction pour charger l'historique d'une conversation
    const loadConversationHistory = async (convId) => {
        try {
            setIsLoading(true);
            console.log(`Chargement de l'historique pour la conversation: ${convId}`);
            
            // Utiliser l'ID de conversation pour ConversationHistory
            // Ne pas effacer l'historique, juste définir l'ID de conversation
            await conversationHistory.setConversationId(convId); // Définir l'ID de conversation
            
            // Appel API pour récupérer les messages de la conversation
            // Utiliser la nouvelle route avec paramètre de requête au lieu de paramètre de chemin
            const apiUrl = `${API_CONFIG.BASE_URL.replace('/api/bard', '/api')}/conversation-messages?id=${convId}`;
            const token = await AsyncStorage.getItem('@auth_token');
            
            if (!token) {
                console.warn('Token manquant pour charger l\'historique');
                return;
            }
            
            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erreur lors du chargement de l'historique: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Historique chargé:', data);
            
            if (data && Array.isArray(data.messages) && data.messages.length > 0) {
                // Convertir les messages au format GiftedChat
                const formattedMessages = data.messages.map(msg => ({
                    _id: msg.id || Math.random().toString(36).substring(7),
                    text: msg.content,
                    createdAt: new Date(msg.timestamp || msg.created_at),
                    user: {
                        _id: msg.sender_type === 'bot' ? 2 : 1,
                        name: msg.sender_type === 'bot' ? selectedFace?.name || 'Assistant' : 'Vous',
                        avatar: msg.sender_type === 'bot' ? selectedFace?.image : undefined
                    }
                })).reverse(); // GiftedChat affiche les messages du plus récent au plus ancien
                
                setMessages(formattedMessages);
                
                // Reconstruire l'historique pour la continuité de la conversation
                await conversationHistory.clearHistoryOnly(); // Effacer l'historique actuel mais garder l'ID
                for (const msg of data.messages) {
                    await conversationHistory.addMessage(
                        msg.sender_type === 'bot' ? 'assistant' : 'user',
                        msg.content
                    );
                }
            } else {
                // Si pas de messages ou format incorrect, afficher un message de bienvenue
                if (selectedFace) {
        const initialMessage = {
            _id: 1,
            text: `Bonjour ! Je suis ${selectedFace.name}. Comment puis-je t'aider?`,
            createdAt: new Date(),
            user: {
                _id: 2,
                name: selectedFace.name,
                avatar: selectedFace.image,
            },
        };
        setMessages([initialMessage]);
                }
            }
        } catch (error) {
            console.error('Erreur lors du chargement de l\'historique:', error);
            Alert.alert('Erreur', 'Impossible de charger l\'historique de la conversation');
        } finally {
            setIsLoading(false);
        }
    };

    const onSend = useCallback(async (messages = []) => {
        if (!isConnected) {
            showConnectionAlert();
            return;
        }

        // Si une requête est déjà en cours et qu'on a un contrôleur d'abandon, annuler la requête
        if (isRequestInProgress && abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsRequestInProgress(false);
            setIsLoading(false);
            setIsTyping(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        setIsTyping(true);
        setShowWelcome(false); // Masquer le message de bienvenue lors de l'envoi d'un message
        setIsRequestInProgress(true);
        
        // Créer un nouveau contrôleur d'abandon
        abortControllerRef.current = new AbortController();
        
        try {
            console.log('=== Début de l\'envoi du message ===');
            console.log('Message à envoyer:', messages[0].text);
            
            setMessages(previousMessages => GiftedChat.append(previousMessages, messages));
            
            const userMessage = messages[0].text;
            console.log('Appel de getBard avec le message:', userMessage);
            
            // Si on a un ID de conversation, l'utiliser
            const response = await getBard(userMessage, conversationId, abortControllerRef.current.signal);
            console.log('Réponse reçue de getBard:', response);
            
            // Si la réponse contient un ID de conversation, le sauvegarder
            if (response && response.conversationId) {
                // Si on a un nouvel ID ou pas d'ID précédent, mettre à jour
                if (!conversationId || response.conversationId !== conversationId) {
                    setConversationId(response.conversationId);
                    console.log('ID de conversation mis à jour:', response.conversationId);
                }
            }
            
            if (response && response.reply) {
                // Vérifier si c'est une réponse de fallback
                const isFallback = response.isFallback === true;
                
                const botMessage = {
                    _id: Math.random().toString(36).substring(7),
                    text: response.reply,
                    createdAt: new Date(),
                    user: {
                        _id: 2,
                        name: selectedFace.name,
                        avatar: selectedFace.image,
                    },
                    // Ajouter des métadonnées pour identifier les réponses de fallback
                    isFallback: isFallback,
                    errorType: response.errorType
                };
                
                console.log('Message du bot créé:', botMessage);
                setMessages(previousMessages => GiftedChat.append(previousMessages, [botMessage]));
                
                // Si c'est une réponse de fallback due à un timeout, proposer de réessayer après un délai
                if (isFallback && (response.errorType === 'TimeoutError' || response.errorType === 'timeout')) {
                    // Attendre 5 secondes avant de proposer de réessayer
                    setTimeout(() => {
                        const retryMessage = {
                            _id: Math.random().toString(36).substring(7),
                            text: "Voulez-vous que je réessaie de répondre à votre question de manière plus concise?",
                            createdAt: new Date(),
                            user: {
                                _id: 2,
                                name: selectedFace.name,
                                avatar: selectedFace.image,
                            },
                            quickReplies: {
                                type: 'radio',
                                keepIt: true,
                                values: [
                                    {
                                        title: 'Oui, réessayez',
                                        value: 'retry',
                                    },
                                    {
                                        title: 'Non merci',
                                        value: 'cancel',
                                    }
                                ],
                            }
                        };
                        setMessages(previousMessages => GiftedChat.append(previousMessages, [retryMessage]));
                    }, 5000);
                }
            } else {
                console.error('Réponse invalide de getBard:', response);
                throw new Error('Réponse invalide du serveur');
            }
        } catch (error) {
            // Ne pas afficher d'erreur si la requête a été annulée volontairement
            if (error.name === 'AbortError') {
                console.log('Requête annulée par l\'utilisateur');
                return;
            }
            
            console.error('Erreur dans onSend:', error);
            setError(error.message);
            Alert.alert(
                'Erreur',
                `Impossible d'obtenir une réponse: ${error.message}`,
                [{ text: 'OK' }]
            );
        } finally {
            setIsLoading(false);
            setIsTyping(false);
            setIsRequestInProgress(false);
            abortControllerRef.current = null;
        }
    }, [selectedFace, isConnected, conversationId, isRequestInProgress]);

    // Gestionnaire pour les questions rapides
    const handleQuickQuestion = async (question) => {
        setShowWelcome(false);
        await onSend([{
            _id: Math.random().toString(36).substring(7),
            text: question.text,
            createdAt: new Date(),
            user: { _id: 1 }
        }]);
    };

    // Gestionnaire pour les réponses rapides
    const onQuickReply = useCallback((replies) => {
        const reply = replies[0];
        if (reply.value === 'retry') {
            // Récupérer le dernier message de l'utilisateur
            const userMessages = messages.filter(m => m.user._id === 1);
            if (userMessages.length > 0) {
                const lastUserMessage = userMessages[userMessages.length - 1];
                // Reformuler la question pour être plus concise
                const shortenedMessage = `${lastUserMessage.text.substring(0, 100)}${lastUserMessage.text.length > 100 ? '...' : ''}`;
                onSend([{
                    _id: Math.random().toString(36).substring(7),
                    text: shortenedMessage,
                    createdAt: new Date(),
                    user: { _id: 1 }
                }]);
            }
        }
    }, [messages, onSend]);

    // Composant de message de bienvenue
    const WelcomeMessage = () => (
        <View style={styles.welcomeContainer}>
            <View style={styles.welcomeMessage}>
                <Text style={styles.welcomeTitle}>👋 Bonjour !</Text>
                <Text style={styles.welcomeSubtitle}>Posez-moi vos questions sur notre entreprise</Text>
                <ScrollView style={styles.quickQuestionsContainer}>
                    {QUICK_QUESTIONS.map(question => (
                        <TouchableOpacity
                            key={question.id}
                            style={styles.quickQuestionButton}
                            onPress={() => handleQuickQuestion(question)}
                        >
                            <MaterialIcons name={question.icon} size={20} color="#0A1E3F" />
                            <Text style={styles.quickQuestionText}>{question.text}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
    const renderBubble = (props) => {
        return (
            <Bubble
                {...props}
                wrapperStyle={{
                    right: {
                        backgroundColor: '#OA1E3F',
                        borderRadius: 20,
                        borderBottomRightRadius: 6,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 2,
                        marginHorizontal: 5,
                    },
                    left: {
                        backgroundColor: '#0A1E3F',
                        borderRadius: 20,
                        borderBottomLeftRadius: 6,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 2,
                        marginHorizontal: 5,
                    },
                }}
                textStyle={{
                    right: {
                        color: '#000',
                        fontSize: 15,
                    },
                    left: {
                        color: '#fff',
                        fontSize: 15,
                    },
                }}
            />
        );
    };

    const renderSend = (props) => {
        // Si une requête est en cours, afficher le bouton d'annulation
        if (isRequestInProgress) {
            return (
                <Send
                    {...props}
                    containerStyle={styles.sendButtonContainer}
                    alwaysShowSend={true}
                >
                    <TouchableOpacity 
                        style={[styles.sendButton, styles.cancelButton]}
                        onPress={() => onSend([])} // Appeler onSend sans message pour annuler
                    >
                        <MaterialIcons name="close" size={24} color="#999" />
                    </TouchableOpacity>
                </Send>
            );
        }
        
        // Sinon, afficher le bouton d'envoi normal
        return (
            <Send
                {...props}
                containerStyle={styles.sendButtonContainer}
                alwaysShowSend={true}
            >
                <View style={styles.sendButton}>
                    <MaterialIcons name="send" size={24} color="#999" />
                </View>
            </Send>
        );
    };

    // Fonction personnalisée pour afficher la barre d'entrée de texte (input)
const renderInputToolbar = (props) => {
    return (
        <InputToolbar
            {...props} // On passe toutes les props d'origine fournies par GiftedChat
            containerStyle={styles.inputToolbarContainer} // Style du conteneur principal de la barre d'entrée
            primaryStyle={styles.inputToolbarPrimary}     // Style de la zone de saisie à l'intérieur de la barre
        />
    );
};

// Fonction personnalisée pour le champ de texte où l'utilisateur écrit son message
const renderComposer = (props) => {
    return (
        <Composer
            {...props} // On hérite des comportements de base
            textInputStyle={styles.composerInput}         // Style personnalisé du champ de texte
            placeholderTextColor="#999"                   // Couleur du texte du placeholder
            placeholder="Posez votre question..."         // Texte affiché par défaut dans le champ
        />
    );
};

// Fonction pour afficher un indicateur de saisie animé pendant que le bot "écrit"
const renderFooter = () => {
    if (isLoading) {
        return (
            <View style={styles.typingContainer}>
                <TypingIndicator /> {/* Composant animé avec des points animés */}
                <Text style={styles.typingText}>
                    {selectedFace.name} écrit... {/* Affiche le nom de l'avatar ou personne qui écrit */}
                </Text>
            </View>
        );
    }
    return null; // Si rien ne charge, on ne retourne rien
};

// Fonction pour afficher un message animé si l'utilisateur perd sa connexion Internet
const renderConnectionStatus = () => {
    if (!isConnected) {
        return (
            <Animated.View style={[styles.connectionStatus, { opacity: fadeAnim }]}>
                <Ionicons name="wifi-off" size={20} color="white" /> {/* Icône de WiFi désactivé */}
                <Text style={styles.connectionText}>Pas de connexion internet</Text> {/* Message texte */}
            </Animated.View>
        );
    }
    return null; // Si connecté, aucun message n'est affiché
};


    // Conditional rendering after all hooks
    if (!selectedFace) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Chargement du chat...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Layout fixe contenant à la fois le sidebar et le contenu principal */}
            <View style={styles.layoutContainer}>
                {/* Sidebar avec position absolute */}
                <Animated.View 
                    style={[
                        styles.sidebarContainer,
                        { 
                            transform: [{ 
                                translateX: isSidebarVisible ? 0 : -SIDEBAR_WIDTH 
                            }]
                        }
                    ]}
                >
                    {/* Bouton de fermeture dans la sidebar */}
                    <TouchableOpacity 
                        style={styles.sidebarToggleButton}
                        onPress={() => toggleSidebar(false)}
                    >
                        <Feather name="sidebar" size={24} color="#0A1E3F" />
                    </TouchableOpacity>
                    
                    <Sidebar 
                        isVisible={isSidebarVisible} 
                        onClose={() => toggleSidebar(false)} 
                    />
                </Animated.View>

                {/* Contenu principal qui se redimensionne */}
                <Animated.View 
                    style={[
                        styles.mainContent,
                        { 
                            width: contentWidth,
                            marginLeft: isSidebarVisible ? SIDEBAR_WIDTH : 0
                        }
                    ]}
                >
                 {renderConnectionStatus()}
                    <LinearGradient
                        colors={['#003366', '#002244']}
                        style={styles.header}
                    >
                        {/* Bouton d'ouverture de la sidebar dans le header */}
                        <Animated.View style={{ opacity: menuButtonOpacity }}>
                <TouchableOpacity 
                                style={styles.menuButton}
                                onPress={() => toggleSidebar(true)}
                >
                                <Feather name="sidebar" size={24} color="#0A1E3F" />
                </TouchableOpacity>
                        </Animated.View>
                        
                <Image
                    source={{ uri: selectedFace.image }}
                    style={styles.avatar}
                        />
                        <View style={styles.headerInfo}>
                            <Text style={styles.headerTitle}>{selectedFace.name}</Text>
                            <Text style={styles.headerSubtitle}>Informations & Support</Text>
                        </View>
                        <View style={styles.logoContainer}>
                            <Image 
                                source={require('../../assets/favicon.jpg')}
                                style={styles.logo}
                                resizeMode="cover"
                            />        
                        </View>
                    </LinearGradient>
                    
                    {showWelcome && <WelcomeMessage />}
                    
            <GiftedChat
                messages={messages}
                onSend={messages => onSend(messages)}
                        user={{ _id: 1 }}
                renderBubble={renderBubble}
                renderSend={renderSend}
                renderInputToolbar={renderInputToolbar}
                        renderComposer={renderComposer}
                alwaysShowSend={true}
                scrollToBottom={true}
                scrollToBottomComponent={() => null}
                renderAvatarOnTop={true}
                showUserAvatar={false}
                renderUsernameOnMessage={true}
                inverted={true}
                timeTextStyle={{
                    left: { color: '#fff' },
                    right: { color: 'gray' },
                }}
                renderFooter={renderFooter}
                        listViewProps={{
                            style: styles.chatList,
                            contentContainerStyle: styles.chatListContent,
                        }}
                onQuickReply={onQuickReply}
            />
                </Animated.View>
                </View>
        </View>
    );
};

const styles = StyleSheet.create({
    // Conteneur principal de l'application
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },

    // Conteneur pour la disposition générale en ligne
    layoutContainer: {
        flex: 1,
        flexDirection: 'row',
    },

    // Style de la barre latérale
    sidebarContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: SIDEBAR_WIDTH,
        zIndex: 1000,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },

    // Bouton pour ouvrir ou fermer la sidebar
    sidebarToggleButton: {
        position: 'absolute',
        top: 20,
        right: 15,
        width: 35,
        height: 35,
        borderRadius: 17.5,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },

    // Conteneur du contenu principal
    mainContent: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },

    // En-tête de l'application
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        paddingTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },

    // Bouton menu dans le header
    menuButton: {
        width: 35,
        height: 35,
        borderRadius: 17.5,
        backgroundColor: '#A1E3F',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },

    // Avatar utilisateur
    avatar: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },

    // Informations utilisateur dans le header
    headerInfo: {
        flex: 1,
        marginLeft: 10,
    },

    // Nom de l'utilisateur
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },

    // Sous-titre (ex: statut) de l'utilisateur
    headerSubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        marginTop: 2,
    },

    // Conteneur du logo
    logoContainer: {
        backgroundColor: '#OA1E3F',
        padding: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        width: 90,
        height: 70,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10
    },

    // Style de l'image du logo
    logo: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
        overflow: 'hidden'
    },

    // Conteneur du message de bienvenue
    welcomeContainer: {
        padding: 28,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },

    // Carte contenant le message de bienvenue
    welcomeMessage: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        width: '80%',
        maxWidth: 350,
    },

    // Titre du message de bienvenue
    welcomeTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 6,
        textAlign: 'center',
    },

    // Sous-titre du message de bienvenue
    welcomeSubtitle: {
        fontSize: 13,
        color: '#0A1E3F',
        marginBottom: 12,
        textAlign: 'center',
    },

    // Conteneur des questions rapides
    quickQuestionsContainer: {
        maxHeight: 180,
    },

    // Boutons pour les questions rapides
    quickQuestionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 20,
        marginBottom: 2,
        borderWidth: 1,
        borderColor: '#0A1E3F'
    },

    // Texte des boutons de questions rapides
    quickQuestionText: {
        marginLeft: 10,
        fontSize: 14,
        color: '#141414'
    },

    // Conteneur de la barre d'entrée du message
    inputToolbarContainer: {
        backgroundColor: '#f8f9fa',
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
        padding: 10,
        marginHorizontal: 5,
    },

    // Élément principal de la barre d'entrée
    inputToolbarPrimary: {
        alignItems: 'center',
    },

    // Champ de saisie du message
    composerInput: {
        backgroundColor: '#fff',
        borderRadius: 25,
        paddingHorizontal: 15,
        paddingVertical: 10,
        fontSize: 15,
        color: '#OA1E3F',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },

    // Conteneur du bouton d’envoi
    sendButtonContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },

    // Bouton pour envoyer un message
    sendButton: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: '#0A1E3F',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },

    // Style pour le bouton d'annulation
    cancelButton: {
        backgroundColor: '#0A1E3F',
    },

    // Conteneur de l'indicateur de frappe
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#f1f3f4',
        borderRadius: 18,
        marginHorizontal: 15,
        marginBottom: 10,
        alignSelf: 'flex-start',
    },

    // Groupe des points de frappe
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    // Point de frappe 1
    typingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#9e9e9e',
        marginHorizontal: 2,
    },

    // Point 2 : plus petit
    typingDot2: {
        opacity: 0.7,
        transform: [{ scale: 0.8 }]
    },

    // Point 3 : encore plus petit
    typingDot3: {
        opacity: 0.4,
        transform: [{ scale: 0.6 }]
    },

    // Texte indiquant "Utilisateur est en train d'écrire..."
    typingText: {
        marginLeft: 8,
        fontSize: 13,
        color: '#666',
    },

    // Liste des messages du chat
    chatList: {
        flex: 1,
        width: '100%',
    },

    // Contenu de la liste des messages
    chatListContent: {
        paddingHorizontal: 5,
        paddingBottom: 10,
        alignItems: 'stretch',
    },

    // Bandeau indiquant l’état de connexion
    connectionStatus: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0A1E3F',
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        marginTop: 60,
        borderRadius: 8,
        marginHorizontal: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5
    },

    // Texte de l'état de connexion
    connectionText: {
        color: 'white',
        marginLeft: 8,
        fontSize: 14,
    },

    // Conteneur de l'écran de chargement
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },

    // Texte affiché pendant le chargement
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
});


// Ajouter une animation pour les points de typing
// Déclaration d'un composant fonctionnel React Native appelé TypingIndicator
const TypingIndicator = () => {
    // Création des états pour contrôler l'opacité de chaque point animé
    const [dot1Opacity] = useState(new Animated.Value(1));    // Point 1 : commence avec une opacité maximale
    const [dot2Opacity] = useState(new Animated.Value(0.7));  // Point 2 : opacité moyenne
    const [dot3Opacity] = useState(new Animated.Value(0.4));  // Point 3 : opacité minimale

    // Hook useEffect lancé au montage du composant
    useEffect(() => {
        // Fonction récursive qui gère l'animation en boucle
        const animate = () => {
            Animated.sequence([ // Exécute les animations dans un ordre séquentiel
                Animated.parallel([ // Premier groupe d'animations en parallèle
                    Animated.timing(dot1Opacity, {
                        toValue: 0.4, // Point 1 devient plus transparent
                        duration: 400,
                        useNativeDriver: true
                    }),
                    Animated.timing(dot2Opacity, {
                        toValue: 1, // Point 2 devient complètement opaque
                        duration: 400,
                        useNativeDriver: true
                    }),
                    Animated.timing(dot3Opacity, {
                        toValue: 0.7, // Point 3 devient moyennement opaque
                        duration: 400,
                        useNativeDriver: true
                    })
                ]),
                Animated.parallel([ // Deuxième groupe
                    Animated.timing(dot1Opacity, {
                        toValue: 0.7,
                        duration: 400,
                        useNativeDriver: true
                    }),
                    Animated.timing(dot2Opacity, {
                        toValue: 0.4,
                        duration: 400,
                        useNativeDriver: true
                    }),
                    Animated.timing(dot3Opacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true
                    })
                ]),
                Animated.parallel([ // Troisième groupe
                    Animated.timing(dot1Opacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true
                    }),
                    Animated.timing(dot2Opacity, {
                        toValue: 0.7,
                        duration: 400,
                        useNativeDriver: true
                    }),
                    Animated.timing(dot3Opacity, {
                        toValue: 0.4,
                        duration: 400,
                        useNativeDriver: true
                    })
                ])
            ]).start(() => animate()); // Relance l'animation une fois terminée (boucle infinie)
        };

        animate(); // Démarre l'animation au montage du composant
    }, []);

    // Rendu visuel : 3 cercles animés représentant l'indicateur de saisie
    return (
        <View style={styles.typingIndicator}>
            <Animated.View style={[styles.typingDot, { opacity: dot1Opacity }]} />
            <Animated.View style={[styles.typingDot, { opacity: dot2Opacity }]} />
            <Animated.View style={[styles.typingDot, { opacity: dot3Opacity }]} />
        </View>
    );
};


export default ChatScreen;
