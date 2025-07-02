import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Alert, ActivityIndicator, TouchableOpacity, Text, Animated, ScrollView, Dimensions, Platform, Modal } from 'react-native';
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
import { launchImageLibrary, MediaType } from 'react-native-image-picker';

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
    const [isSidebarVisible, setIsSidebarVisible] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [isRequestInProgress, setIsRequestInProgress] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [fullScreenImage, setFullScreenImage] = useState(null);
    const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [voiceError, setVoiceError] = useState(null);
    const [hasVoiceSupport, setHasVoiceSupport] = useState(false);
    const [voiceConversation, setVoiceConversation] = useState([]);
    const [voiceMode, setVoiceMode] = useState('idle'); // idle, listening, processing, speaking
    const recognitionRef = useRef(null);
    const synthRef = useRef(null);
    const abortControllerRef = useRef(null);
    const contentWidth = useRef(new Animated.Value(SCREEN_WIDTH - (isSidebarVisible ? SIDEBAR_WIDTH : 50))).current;
    const [menuButtonOpacity] = useState(new Animated.Value(1));
    const fadeAnim = new Animated.Value(0);

    // S'assurer que l'indicateur de frappe est désactivé au démarrage
    useEffect(() => {
        setIsTyping(false);
    }, []);

    // Vérifier le support de la reconnaissance vocale et synthèse vocale
    useEffect(() => {
        const checkVoiceSupport = () => {
            if (Platform.OS === 'web') {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                const speechSynthesis = window.speechSynthesis;
                
                setHasVoiceSupport(!!(SpeechRecognition && speechSynthesis));
                
                if (SpeechRecognition && speechSynthesis) {
                    // Configuration de la reconnaissance vocale
                    const recognition = new SpeechRecognition();
                    recognition.continuous = false;
                    recognition.interimResults = true;
                    recognition.lang = 'fr-FR';
                    
                    recognition.onstart = () => {
                        setIsListening(true);
                        setVoiceMode('listening');
                        setVoiceError(null);
                        console.log('Reconnaissance vocale démarrée');
                    };
                    
                    recognition.onresult = (event) => {
                        let finalTranscript = '';
                        let interimTranscript = '';
                        
                        for (let i = event.resultIndex; i < event.results.length; i++) {
                            const transcript = event.results[i][0].transcript;
                            if (event.results[i].isFinal) {
                                finalTranscript += transcript;
                            } else {
                                interimTranscript += transcript;
                            }
                        }
                        
                        // Mise à jour en douceur du transcript pour éviter les saccades
                        const currentTranscript = finalTranscript || interimTranscript;
                        if (currentTranscript !== transcript) {
                            setTranscript(currentTranscript);
                        }
                        
                        if (finalTranscript && !processingTranscriptRef.current) {
                            console.log('Transcription finale:', finalTranscript);
                            processingTranscriptRef.current = true;
                            // Traitement direct avec un délai minimal
                            setTimeout(() => {
                                handleVoiceMessage(finalTranscript);
                            }, 200);
                        }
                    };
                    
                    recognition.onerror = (event) => {
                        console.error('Erreur de reconnaissance vocale:', event.error);
                        setVoiceError(`Erreur: ${event.error}`);
                        setIsListening(false);
                        setVoiceMode('idle');
                    };
                    
                    recognition.onend = () => {
                        setIsListening(false);
                        console.log('Reconnaissance vocale terminée');
                        
                        // Réinitialiser la référence de traitement après un délai
                        setTimeout(() => {
                            processingTranscriptRef.current = false;
                        }, 1000);
                    };
                    
                    recognitionRef.current = recognition;
                    
                    // Configuration de la synthèse vocale
                    synthRef.current = speechSynthesis;
                }
            } else {
                // Pour React Native mobile, vous pourriez utiliser une librairie comme react-native-voice
                setHasVoiceSupport(false);
                console.log('Reconnaissance vocale non supportée sur mobile dans cette implémentation');
            }
        };
        
        checkVoiceSupport();
    }, []);

    // Référence pour éviter les traitements multiples
    const processingTranscriptRef = useRef(false);

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
            useNativeDriver: Platform.OS !== 'web',
        }).start();
    };

    // Vérification des paramètres de route et initialisation
    useEffect(() => {
        const initializeChat = async () => {
            try {
                setIsTyping(false); // S'assurer que l'indicateur de frappe est désactivé au démarrage
                
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
            useNativeDriver: Platform.OS !== 'web',
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
                
                // Pas de message initial automatique, garder seulement le conteneur de bienvenue
                setMessages([]);
                
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
            console.log('Écran de discussion monté avec selectedFace :', selectedFace);
            // Pas de message initial automatique, garder seulement le conteneur de bienvenue
            setMessages([]);
        }
    }, [selectedFace, route.params, messages.length]);

    const showConnectionAlert = useCallback(() => {
        Alert.alert(
            'Connexion perdue',
            'Veuillez vérifier votre connexion internet',
            [{ text: 'OK' }]
        );
    }, []);

    // Fonctions pour l'assistant vocal complet
    const startVoiceAssistant = () => {
        if (!hasVoiceSupport) {
            Alert.alert(
                'Non supporté',
                'L\'assistant vocal n\'est pas supporté sur cet appareil ou navigateur.',
                [{ text: 'OK' }]
            );
            return;
        }
        
        setIsVoiceModalVisible(true);
        setVoiceConversation([]);
        setTranscript('');
        setVoiceError(null);
        setVoiceMode('idle');
        
        // Message de bienvenue vocal
        setTimeout(() => {
            speakText("Bonjour ! Je suis votre assistant vocal. Que puis-je faire pour vous ?");
        }, 500);
    };
    
    const startListening = () => {
        console.log('🎙️ startListening appelé - État actuel:', {
            hasRecognition: !!recognitionRef.current,
            isListening,
            voiceMode
        });
        
        if (recognitionRef.current && !isListening && voiceMode !== 'processing') {
            setTranscript('');
            setVoiceError(null);
            console.log('🔴 Passage en mode listening');
            setVoiceMode('listening');
            processingTranscriptRef.current = false;
            try {
                recognitionRef.current.start();
                console.log('✅ Recognition started successfully');
            } catch (error) {
                console.error('❌ Erreur lors du démarrage de la reconnaissance:', error);
                setVoiceError('Impossible de démarrer la reconnaissance vocale');
                setVoiceMode('idle');
            }
        } else {
            console.log('⚠️ Conditions non remplies pour démarrer l\'écoute');
        }
    };
    
    const stopListening = () => {
        console.log('🛑 stopListening appelé - État actuel:', { isListening, voiceMode });
        
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            console.log('✅ Recognition stopped');
        }
        setIsListening(false);
        console.log('⚫ Passage en mode idle');
        setVoiceMode('idle');
    };
    
    const stopSpeaking = () => {
        if (synthRef.current) {
            synthRef.current.cancel();
            setIsSpeaking(false);
            setVoiceMode('idle');
        }
    };
    
    const speakText = (text) => {
        if (!synthRef.current || !text.trim()) return;
        
        // Arrêter toute synthèse en cours
        synthRef.current.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        utterance.onstart = () => {
            setIsSpeaking(true);
            setVoiceMode('speaking');
            console.log('Synthèse vocale démarrée');
        };
        
        utterance.onend = () => {
            setIsSpeaking(false);
            setVoiceMode('idle');
            console.log('Synthèse vocale terminée');
            
            // Démarrer automatiquement l'écoute après la réponse avec un délai plus long
            setTimeout(() => {
                if (isVoiceModalVisible && voiceMode === 'idle') {
                    startListening();
                }
            }, 1500);
        };
        
        utterance.onerror = (event) => {
            console.error('Erreur de synthèse vocale:', event.error);
            setIsSpeaking(false);
            setVoiceMode('idle');
        };
        
        synthRef.current.speak(utterance);
    };
    
    const handleVoiceMessage = async (message) => {
        if (!message.trim() || voiceMode === 'processing') return;
        
        console.log('Traitement du message vocal:', message);
        setVoiceMode('processing');
        
        // Ajouter le message de l'utilisateur à la conversation vocale
        const userMessage = {
            id: Date.now(),
            text: message,
            sender: 'user',
            timestamp: new Date()
        };
        
        setVoiceConversation(prev => [...prev, userMessage]);
        
        try {
            // Envoyer le message à l'API
            const response = await getBard(message, conversationId);
            
            if (response && response.reply) {
                // Ajouter la réponse du bot à la conversation vocale
                const botMessage = {
                    id: Date.now() + 1,
                    text: response.reply,
                    sender: 'bot',
                    timestamp: new Date()
                };
                
                setVoiceConversation(prev => [...prev, botMessage]);
                
                // Synthétiser la réponse
                speakText(response.reply);
                
                // Mettre à jour l'ID de conversation si nécessaire
                if (response.conversationId && response.conversationId !== conversationId) {
                    setConversationId(response.conversationId);
                }
            } else {
                throw new Error('Réponse invalide du serveur');
            }
        } catch (error) {
            console.error('Erreur lors du traitement du message vocal:', error);
            const errorMessage = "Désolé, je n'ai pas pu traiter votre demande. Pouvez-vous réessayer ?";
            
            const errorBotMessage = {
                id: Date.now() + 1,
                text: errorMessage,
                sender: 'bot',
                timestamp: new Date()
            };
            
            setVoiceConversation(prev => [...prev, errorBotMessage]);
            speakText(errorMessage);
        }
        
        // Nettoyer le transcript
        setTranscript('');
    };
    
    const closeVoiceAssistant = () => {
        stopListening();
        stopSpeaking();
        setIsVoiceModalVisible(false);
        setVoiceConversation([]);
        setTranscript('');
        setVoiceError(null);
        setVoiceMode('idle');
        processingTranscriptRef.current = false;
    };

    // Fonction pour sélectionner une image
    const selectImage = () => {
        const options = {
            mediaType: 'photo',
            includeBase64: false,
            maxHeight: 3000,
            maxWidth: 3000,
            quality: 1.0,
            selectionLimit: 1,
        };

        launchImageLibrary(options, (response) => {
            if (response.didCancel) {
                console.log('Sélection d\'image annulée');
                return;
            }

            if (response.errorMessage) {
                console.error('Erreur ImagePicker:', response.errorMessage);
                Alert.alert(
                    'Erreur',
                    'Impossible de sélectionner l\'image. Veuillez réessayer.',
                    [{ text: 'OK' }]
                );
                return;
            }

            if (response.assets && response.assets.length > 0) {
                 const imageUri = response.assets[0].uri;
                 
                 // Stocker l'image sélectionnée pour permettre à l'utilisateur d'ajouter du texte
                 setSelectedImage({
                     uri: imageUri,
                     fileName: response.assets[0].fileName || 'image.jpg',
                     type: response.assets[0].type || 'image/jpeg'
                 });
                 
                 console.log('Image sélectionnée:', imageUri);
             }
        });
    };

    // Fonction pour charger l'historique d'une conversation
    const loadConversationHistory = async (convId) => {
        try {
            setIsLoading(true);
            setIsTyping(false); // S'assurer que l'indicateur de frappe est désactivé pendant le chargement
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
                // Si pas de messages ou format incorrect, pas de message automatique
                // Garder seulement le conteneur de bienvenue
                setMessages([]);
            }
        } catch (error) {
            console.error('Erreur lors du chargement de l\'historique:', error);
            Alert.alert('Erreur', 'Impossible de charger l\'historique de la conversation');
        } finally {
            setIsLoading(false);
            setIsTyping(false); // S'assurer que l'indicateur de frappe est désactivé après le chargement
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
        setIsTyping(true); // Activer l'indicateur de frappe
        setShowWelcome(false); // Masquer le message de bienvenue lors de l'envoi d'un message
        setIsRequestInProgress(true);
        
        // Créer un nouveau contrôleur d'abandon
        abortControllerRef.current = new AbortController();
        
        try {
            console.log('=== Début de l\'envoi du message ===');
            console.log('Message à envoyer:', messages[0]?.text || '');
            
            // Si une image est sélectionnée, l'ajouter au message
            let messageToSend = messages[0] || { _id: Math.random().toString(36).substring(7), text: '', createdAt: new Date(), user: { _id: 1 } };
            
            // Vérifier si une image est sélectionnée
            if (selectedImage) {
                console.log('Image sélectionnée:', selectedImage.uri);
                
                // Créer une copie du message avec l'image
                messageToSend = {
                    ...messageToSend,
                    image: selectedImage.uri
                };
            
            // Réinitialiser l'image sélectionnée AVANT d'ajouter le message à l'affichage
                setSelectedImage(null);
            }

            // Ajouter le message à l'interface utilisateur
            setMessages(previousMessages => {
    const newMessages = GiftedChat.append(previousMessages, [messageToSend]);
                console.log('Messages after sending:', newMessages.length);
    return newMessages;
});
            
            // Extraire uniquement le texte du message pour l'envoyer au serveur
            // Ne pas inclure l'image dans la requête API
            const userMessage = messageToSend.text;
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
            setIsTyping(false); // Désactiver l'indicateur de frappe
            setIsRequestInProgress(false);
            abortControllerRef.current = null;
        }
    }, [selectedFace, isConnected, conversationId, isRequestInProgress, selectedImage]);

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
    const WelcomeMessage = () => {
        const [isDropdownOpen, setIsDropdownOpen] = useState(false);
        
        return (
            <View style={styles.welcomeContainer}>
                <View style={styles.welcomeMessage}>
                    <TouchableOpacity 
                        style={styles.dropdownHeader}
                        onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                        <View style={styles.dropdownHeaderContent}>
                            <Text style={styles.welcomeTitle}>👋 Bonjour !</Text>
                            <Text style={styles.welcomeSubtitle}>Posez-moi vos questions sur notre entreprise</Text>
                        </View>
                        <MaterialIcons 
                            name={isDropdownOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                            size={24} 
                            color="#0A1E3F" 
                        />
                    </TouchableOpacity>
                    
                    {isDropdownOpen && (
                        <ScrollView style={styles.quickQuestionsContainer}>
                            {QUICK_QUESTIONS.map(question => (
                                <TouchableOpacity
                                    key={question.id}
                                    style={styles.quickQuestionButton}
                                    onPress={() => {
                                        handleQuickQuestion(question);
                                        setIsDropdownOpen(false);
                                    }}
                                >
                                    <MaterialIcons name={question.icon} size={20} color="#0A1E3F" />
                                    <Text style={styles.quickQuestionText}>{question.text}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        );
    };

// Extracted MessageBubble component for better code organization and maintainability
const MessageBubble = (props) => {
    const { currentMessage } = props;
    const isUser = currentMessage.user._id === 1;

    return (
        <Animated.View 
            style={[
                styles.messageContainer,
                {
                    transform: [{
                        scale: new Animated.Value(0.8)
                    }]
                }
            ]}
            onLayout={() => {
                Animated.spring(new Animated.Value(0.8), {
                    toValue: 1,
                    useNativeDriver: Platform.OS !== 'web',
                    tension: 100,
                    friction: 8,
                }).start();
            }}
        >
            <Bubble
                {...props}
                wrapperStyle={{
                    left: {
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: '#e1e8ed',
                        borderRadius: 20,
                        borderBottomLeftRadius: 5,
                        marginVertical: 4,
                        marginHorizontal: 8,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                        maxWidth: '85%',
                    },
                    right: {
                        backgroundColor: 'transparent',
                        borderRadius: 20,
                        borderBottomRightRadius: 5,
                        marginVertical: 4,
                        marginHorizontal: 8,
                        maxWidth: '85%',
                    }
                }}
                renderMessageText={(textProps) => (
                    <LinearGradient
                        colors={isUser ? ['#667eea', '#764ba2'] : ['transparent', 'transparent']}
                        style={{
                            borderRadius: 20,
                            borderBottomRightRadius: isUser ? 5 : 20,
                            borderBottomLeftRadius: isUser ? 20 : 5,
                            padding: 12,
                        }}
                    >
                        {/* Display image if exists */}
                        {currentMessage.image && (
                            <View style={styles.messageImageContainer}>
                                <Image 
                                    source={{ uri: currentMessage.image }} 
                                    style={styles.messageImage}
                                    resizeMode="contain"
                                />
                                <TouchableOpacity 
                                    style={styles.expandImageButton}
                                    onPress={() => setFullScreenImage(currentMessage.image)}
                                >
                                    <Ionicons name="expand-outline" size={20} color="#555" />
                                </TouchableOpacity>
                            </View>
                        )}
                        
                        {/* Display text if exists, otherwise display empty Text component */}
                        {currentMessage.text ? (
                            <Text style={{
                                color: isUser ? '#ffffff' : '#333333',
                                fontSize: 16,
                                lineHeight: 22,
                                marginTop: currentMessage.image ? 8 : 0,
                            }}>
                                {currentMessage.text}
                            </Text>
                        ) : (
                            <Text style={{ height: 0, width: 0, opacity: 0 }}>{" "}</Text>
                        )}
                    </LinearGradient>
                )}
            />
            <View style={styles.messageFooter}>
                <Text style={styles.messageTime}>
                    {new Date(currentMessage.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </Text>
                <View style={styles.messageReactions}>
                    <TouchableOpacity style={styles.reactionButton}>
                        <Text style={styles.reactionEmoji}>👍</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.reactionButton}>
                        <Text style={styles.reactionEmoji}>❤️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.reactionButton}>
                        <Text style={styles.reactionEmoji}>😊</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
};



const renderBubble = (props) => {
    return <MessageBubble {...props} />;
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
                        onPress={() => onSend([])}
                    >
                        <MaterialIcons name="close" size={24} color="#ffffff" />
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
                <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.sendButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <MaterialIcons name="send" size={24} color="#ffffff" />
                </LinearGradient>
            </Send>
        );
    };

    // Fonction personnalisée pour afficher la barre d'entrée de texte (input)
// Assistant Vocal plein écran inspiré de ChatGPT
const VoiceAssistantModal = () => {
    const centralCircleAnim = useRef(new Animated.Value(1)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const waveAnim = useRef(new Animated.Value(0)).current;
    const [isAnimating, setIsAnimating] = useState(false);
    const animationRef = useRef(null);
    
    // Gestion des animations directe et simple
    useEffect(() => {
        if (voiceMode === 'listening' || voiceMode === 'speaking') {
            console.log('🎬 Démarrage des animations pour mode:', voiceMode);
            
            // Arrêter toutes les animations précédentes
            if (animationRef.current) {
                animationRef.current.stop();
            }
            
            // Animation du cercle central (battement)
            const circleAnimation = Animated.loop(
                Animated.sequence([
                    Animated.timing(centralCircleAnim, {
                        toValue: 1.15,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(centralCircleAnim, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                ])
            );
            
            // Animation de pulsation des ondes
            const pulseAnimation = Animated.loop(
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1800,
                    useNativeDriver: true,
                })
            );
            
            // Animation des ondes sonores
            const waveAnimation = Animated.loop(
                Animated.sequence([
                    Animated.timing(waveAnim, {
                        toValue: 1,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(waveAnim, {
                        toValue: 0,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                ])
            );
            
            // Démarrer toutes les animations
            animationRef.current = Animated.parallel([
                circleAnimation,
                pulseAnimation,
                waveAnimation
            ]);
            
            animationRef.current.start();
            setIsAnimating(true);
            
        } else {
            console.log('⏹️ Arrêt des animations pour mode:', voiceMode);
            
            // Arrêter les animations
            if (animationRef.current) {
                animationRef.current.stop();
                animationRef.current = null;
            }
            
            // Retour aux valeurs par défaut
            Animated.parallel([
                Animated.timing(centralCircleAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(waveAnim, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                })
            ]).start();
            
            setIsAnimating(false);
        }
        
        return () => {
            if (animationRef.current) {
                animationRef.current.stop();
                animationRef.current = null;
            }
        };
    }, [voiceMode]);

    // Mémoriser le message de statut pour éviter les re-renders
    const getStatusMessage = useCallback(() => {
        if (voiceError) return voiceError;
        switch (voiceMode) {
            case 'listening':
                // Afficher la transcription en temps réel seulement si elle n'est pas vide
                if (transcript && transcript.trim()) {
                    return transcript.length > 100 ? transcript.substring(0, 100) + "..." : transcript;
                }
                return "Je vous écoute...";
            case 'processing':
                return "Traitement en cours...";
            case 'speaking':
                return "Je vous réponds...";
            default:
                return "Appuyez sur le cercle pour commencer";
        }
    }, [voiceError, voiceMode, transcript]);

    const getCircleColor = () => {
        console.log('🎨 Mode vocal actuel:', voiceMode);
        switch (voiceMode) {
            case 'listening':
                return '#ef4444'; // Rouge vif pour l'écoute
            case 'processing':
                return '#f59e0b'; // Orange pour le traitement
            case 'speaking':
                return '#10b981'; // Vert pour la parole
            default:
                return '#1a1a1a'; // Gris foncé au lieu de noir pur
        }
    };

    return (
        <Modal
            visible={isVoiceModalVisible}
            transparent={false}
            animationType="fade"
            onRequestClose={closeVoiceAssistant}
        >
            <View style={styles.voiceFullScreenContainer}>
                {/* Header minimal */}
                <View style={styles.voiceFullScreenHeader}>
                    <TouchableOpacity 
                        onPress={closeVoiceAssistant} 
                        style={styles.voiceCloseButton}
                    >
                        <Ionicons name="close" size={28} color="#ffffff" />
                    </TouchableOpacity>
                </View>

                {/* Zone principale avec cercle central */}
                <View style={styles.voiceCentralZone}>
                    {/* Ondes de pulsation - plus visibles */}
                    <View style={styles.pulsationContainer}>
                        {[1, 2, 3].map((index) => (
                            <Animated.View
                                key={`pulse-${index}`}
                                style={[
                                    styles.pulsationRing,
                                    {
                                        opacity: (voiceMode === 'listening' || voiceMode === 'speaking') ? 
                                            pulseAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.8, 0.1],
                                            }) : 0.2,
                                        transform: [{
                                            scale: pulseAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [1, 1.8 + (index * 0.4)],
                                            })
                                        }],
                                        borderColor: voiceMode === 'listening' ? '#ef4444' : 
                                                   voiceMode === 'speaking' ? '#10b981' : 
                                                   'rgba(255, 255, 255, 0.3)'
                                    }
                                ]}
                            />
                        ))}
                    </View>
                    
                    {/* Ondes sonores pour l'écoute */}
                    {voiceMode === 'listening' && (
                        <View style={styles.waveContainer}>
                            {[1, 2, 3, 4, 5].map((index) => (
                                <Animated.View
                                    key={`wave-${index}`}
                                    style={[
                                        styles.waveBar,
                                        {
                                            opacity: waveAnim,
                                            transform: [{
                                                scaleY: waveAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [0.3, 1 + (index * 0.2)],
                                                })
                                            }]
                                        }
                                    ]}
                                />
                            ))}
                        </View>
                    )}
                    
                    {/* Cercle central */}
                    <Animated.View 
                        style={[
                            styles.centralCircle,
                            {
                                backgroundColor: getCircleColor(),
                                transform: [{ scale: centralCircleAnim }]
                            }
                        ]}
                    >
                        <TouchableOpacity
                            style={styles.centralCircleButton}
                            onPress={() => {
                                console.log('🔘 Click sur cercle central, mode actuel:', voiceMode);
                                if (voiceMode === 'listening') {
                                    console.log('🛑 Arrêt de l\'écoute');
                                    stopListening();
                                } else if (voiceMode === 'speaking') {
                                    console.log('🔇 Arrêt de la synthèse');
                                    stopSpeaking();
                                } else if (voiceMode === 'idle') {
                                    console.log('🎤 Démarrage de l\'écoute');
                                    startListening();
                                }
                            }}
                            disabled={voiceMode === 'processing'}
                        >
                            <Ionicons 
                                name={
                                    voiceMode === 'listening' ? "mic" :
                                    voiceMode === 'speaking' ? "volume-high" :
                                    voiceMode === 'processing' ? "hourglass" :
                                    "mic-outline"
                                } 
                                size={64} 
                                color="#ffffff" 
                                style={{
                                    textShadowColor: 'rgba(0, 0, 0, 0.5)',
                                    textShadowOffset: { width: 0, height: 2 },
                                    textShadowRadius: 4,
                                }}
                            />
                        </TouchableOpacity>
                    </Animated.View>
                </View>

                {/* Zone de statut */}
                <View style={styles.voiceStatusZone}>
                    <Text 
                        style={styles.voiceStatusMainText}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                    >
                        {getStatusMessage()}
                    </Text>
                    
                    {/* Indication du mode vocal standard */}
                    <Text style={styles.voiceStandardText}>
                        Standard voice
                    </Text>
                </View>

                {/* Historique de conversation vocale */}
                {voiceConversation.length > 0 && (
                    <View style={styles.voiceConversationContainer}>
                        <ScrollView 
                            style={styles.voiceConversationScroll}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
                        >
                            {voiceConversation.map((message) => (
                                <View 
                                    key={`voice-msg-${message.id}`}
                                    style={[
                                        styles.voiceMessageBubble,
                                        message.sender === 'user' 
                                            ? styles.voiceUserMessage 
                                            : styles.voiceBotMessage
                                    ]}
                                >
                                    <Text style={[
                                        styles.voiceMessageText,
                                        message.sender === 'user' 
                                            ? styles.voiceUserMessageText 
                                            : styles.voiceBotMessageText
                                    ]}>
                                        {message.text}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Boutons de contrôle en bas */}
                <View style={styles.voiceControlButtons}>
                    <TouchableOpacity
                        style={[
                            styles.voiceControlButton,
                            voiceMode === 'listening' && styles.voiceControlButtonActive
                        ]}
                        onPress={() => {
                            if (voiceMode === 'listening') {
                                stopListening();
                            } else if (voiceMode === 'idle') {
                                startListening();
                            }
                        }}
                        disabled={voiceMode === 'processing'}
                    >
                        <Ionicons 
                            name={voiceMode === 'listening' ? "stop" : "mic"} 
                            size={24} 
                            color={voiceMode === 'processing' ? "#666666" : "#ffffff"} 
                        />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                        style={[
                            styles.voiceControlButton,
                            isSpeaking && styles.voiceControlButtonActive
                        ]}
                        onPress={stopSpeaking}
                        disabled={!isSpeaking}
                    >
                        <Ionicons 
                            name="volume-off" 
                            size={24} 
                            color={!isSpeaking ? "#666666" : "#ffffff"} 
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// Extracted InputToolbarWithImage component for better code organization and maintainability
const InputToolbarWithImage = (props) => {
    return (
        <View style={styles.inputToolbarWrapper}>
            <View style={styles.inputContainer}>
                <View style={styles.inputWithImageContainer}>
                    {/* Preview of selected image at top left of input bar */}
                    {selectedImage && (
                        <View style={styles.inputImagePreview}>
                            <Image source={{ uri: selectedImage.uri }} style={styles.inputImageThumbnail} />
                            <TouchableOpacity 
                                style={styles.removeInputImageButton} 
                                onPress={() => setSelectedImage(null)}
                            >
                                <Ionicons name="close-circle" size={16} color="#ff6b6b" />
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={[styles.inputToolbarInner, selectedImage && styles.inputToolbarWithImage]}>
                        <InputToolbar
                            {...props}
                            containerStyle={styles.inputToolbarContainer}
                            primaryStyle={styles.inputToolbarPrimary}
                        />
                    </View>
                </View>
            </View>
            <View style={styles.buttonsRow}>
                <View style={styles.buttonGroup}>
                    <TouchableOpacity style={styles.addButton} onPress={selectImage}>
                        <Ionicons name="image" size={24} color="#ffffff" />
                    </TouchableOpacity>
                </View>
                <View style={styles.buttonGroup}>
                    <TouchableOpacity 
                        style={styles.micButton} 
                        onPress={startVoiceAssistant}
                    >
                        <Ionicons name="mic" size={24} color="#ffffff" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const renderInputToolbar = (props) => {
    return <InputToolbarWithImage {...props} />;
};

// Fonction personnalisée pour le champ de texte où l'utilisateur écrit son message
const renderComposer = (props) => {
    return (
        <Composer
            {...props}
            textInputStyle={styles.composerInput}
            placeholderTextColor="#888888"
            placeholder="Poser une question"
            multiline={true}
        />
    );
};

// Fonction pour afficher un indicateur de saisie animé pendant que le bot "écrit"
const renderFooter = () => {
    if (isTyping) {
        return (
            <View style={styles.typingContainer}>
                <TypingIndicator /> {/* Composant animé avec des points animés */}
                <Text style={styles.typingText}>
                    {selectedFace.name} écrit... {/* Affiche le nom de l'avatar ou personne qui écrit */}
                </Text>
            </View>
        );
    }
    return null; // Si personne n'écrit, on ne retourne rien
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

                {/* Barre d'icônes quand la sidebar est fermée */}
                {!isSidebarVisible && (
                    <View style={styles.collapsedSidebar}>
                        {/* Logo du site */}
                        <View style={styles.collapsedLogo}>
                            <Image 
                                source={require('../../assets/favicon.jpg')}
                                style={styles.collapsedLogoImage}
                                resizeMode="cover"
                            />
                        </View>
                        
                        <TouchableOpacity 
                            style={styles.collapsedIconButton}
                            onPress={() => toggleSidebar(true)}
                        >
                            <Ionicons name="menu" size={24} color="#ffffff" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={styles.collapsedIconButton}
                            onPress={() => navigation.navigate('Home')}
                        >
                            <Ionicons name="home-outline" size={24} color="#ffffff" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={styles.collapsedIconButton}
                            onPress={() => {
                                // Logique pour nouvelle conversation
                                navigation.navigate('Chat', { resetConversation: true });
                            }}
                        >
                            <Ionicons name="add-outline" size={24} color="#ffffff" />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Contenu principal qui se redimensionne */}
                <Animated.View 
                    style={[
                        styles.mainContent,
                        { 
                            width: contentWidth,
                            marginLeft: isSidebarVisible ? SIDEBAR_WIDTH : 50
                        }
                    ]}
                >
                 {renderConnectionStatus()}
                    <LinearGradient
                        colors={['#1a1a1a', '#2d2d2d']}
                        style={styles.header}
                    >
                        {/* Bouton d'ouverture de la sidebar dans le header - seulement si sidebar ouverte */}
                        {isSidebarVisible && (
                            <Animated.View style={{ opacity: menuButtonOpacity }}>
                                <TouchableOpacity 
                                    style={styles.menuButton}
                                    onPress={() => toggleSidebar(true)}
                                >
                                    <Ionicons name="menu" size={24} color="#ffffff" />
                                </TouchableOpacity>
                            </Animated.View>
                        )}
                        
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
                renderMessageImage={() => null}
            />
                </Animated.View>
                </View>
            
            {/* Assistant Vocal Plein Écran */}
            <VoiceAssistantModal />
            
            {/* Modal pour afficher l'image en plein écran */}
            <Modal
                visible={fullScreenImage !== null}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setFullScreenImage(null)}
            >
                <TouchableOpacity 
                    style={styles.fullScreenModalContainer}
                    activeOpacity={1}
                    onPress={() => setFullScreenImage(null)}
                >
                    <TouchableOpacity 
                        style={styles.fullScreenCloseButton}
                        onPress={() => setFullScreenImage(null)}
                    >
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>
                    
                    {fullScreenImage && (
                        <TouchableOpacity 
                            style={styles.fullScreenImageWrapper}
                            activeOpacity={1}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <Image 
                                source={{ uri: fullScreenImage }} 
                                style={styles.fullScreenImage}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    // Conteneur principal de l'application
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
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

    // Barre d'icônes quand la sidebar est fermée
    collapsedSidebar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 50,
        backgroundColor: '#1a1a1a',
        zIndex: 900,
        paddingTop: 20,
        alignItems: 'center',
    },
    
    // Conteneur du logo dans la sidebar fermée
    collapsedLogo: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#333333',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 10,
    },
    
    // Image du logo dans la sidebar fermée
    collapsedLogoImage: {
        width: 30,
        height: 30,
        borderRadius: 15,
    },
    
    // Bouton d'icône dans la sidebar fermée
    collapsedIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#333333',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
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
        padding: 10,
        paddingTop: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },

    // Contenu de l'en-tête
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        width: 35,
        height: 35,
        borderRadius: 17.5,
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
        fontSize: 20,
        fontWeight: '400',
        textAlign: 'left',
        flex: 1,
    },

    // Sous-titre (ex: statut) de l'utilisateur
    headerSubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        marginTop: 2,
        textAlign: 'left',
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
        width: 60,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10
    },

    // Style de l'image du logo
    logo: {
        width: '100%',
        height: '100%',
        borderRadius: 30,
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

    // Header du dropdown
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 5,
    },
    
    // Contenu du header du dropdown
    dropdownHeaderContent: {
        flex: 1,
    },
    
    // Conteneur des questions rapides
    quickQuestionsContainer: {
        maxHeight: 180,
        marginTop: 10,
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
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        padding: 0,
        margin: 0,
    },

    // Élément principal de la barre d'entrée
    inputToolbarPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#404040',
        borderRadius: 20,
        paddingHorizontal: 15,
        minHeight: 40,
    },

    // Champ de saisie du message
    composerInput: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        paddingHorizontal: 0,
        paddingVertical: 10,
        fontSize: 16,
        color: '#ffffff',
        maxHeight: 120,
        minHeight: 40,
        lineHeight: 20,
        flex: 1,
    },

    // Conteneur du bouton d'envoi
    sendButtonContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        marginBottom: 5,
    },

    // Bouton pour envoyer un message
    sendButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },

    // Style pour le bouton d'annulation
    cancelButton: {
        backgroundColor: '#ff6b6b',
        shadowColor: '#ff6b6b',
    },

    // Wrapper pour la barre d'entrée avec boutons d'action
    inputToolbarWrapper: {
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#2d2d2d',
        paddingHorizontal: 20,
        paddingVertical: 20,
        borderRadius: 25,
        marginHorizontal: 40,
        marginBottom: 30,
        maxWidth: 800,
        alignSelf: 'center',
        width: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },

    // Bouton d'ajout (+)
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#404040',
        justifyContent: 'center',
        alignItems: 'center',
    },



    // Conteneur du champ de saisie
    inputContainer: {
        width: '100%',
        marginBottom: 15,
    },
    
    // Rangée de boutons sous le champ de saisie
    buttonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 10,
    },

    // Groupe de boutons côte à côte
    buttonGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },

    // Bouton micro
    micButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#404040',
        justifyContent: 'center',
        alignItems: 'center',
    },



    // Conteneur de l'aperçu d'image
    imagePreviewContainer: {
        position: 'relative',
        alignItems: 'center',
        marginVertical: 10,
        backgroundColor: '#3a3a3a',
        borderRadius: 15,
        padding: 10,
    },

    // Aperçu de l'image sélectionnée
    imagePreview: {
        width: 120,
        height: 120,
        borderRadius: 10,
        resizeMode: 'cover',
    },

    // Bouton pour supprimer l'image
    removeImageButton: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 12,
    },

    // Texte de l'aperçu d'image
    imagePreviewText: {
        color: '#ffffff',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
        fontStyle: 'italic',
    },

    // Bouton de profil
    profileButton: {
        padding: 4,
    },

    // Avatar de profil
    profileAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#404040',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Initiale du profil
    profileInitial: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },

    // Conteneur du message avec animations
    messageContainer: {
        marginVertical: 2,
    },

    // Footer du message avec heure et réactions
    messageFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginHorizontal: 12,
        marginTop: 4,
    },

    // Style de l'heure du message
    messageTime: {
        fontSize: 12,
        color: '#8e8e93',
        fontWeight: '400',
    },

    // Conteneur des réactions
    messageReactions: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    // Bouton de réaction
    reactionButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },

    // Emoji de réaction
    reactionEmoji: {
        fontSize: 14,
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

    // Bandeau indiquant l'état de connexion
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

    // Conteneur pour la barre de saisie avec image
    inputWithImageContainer: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
    },

    // Aperçu de l'image dans la barre de saisie
    inputImagePreview: {
        position: 'relative',
        marginBottom: 8,
        marginLeft: 5,
        alignSelf: 'flex-start',
        borderRadius: 10,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },

    // Miniature de l'image dans la barre de saisie
    inputImageThumbnail: {
        width: 60,
        height: 60,
        borderRadius: 8,
        resizeMode: 'cover',
        borderWidth: 1,
        borderColor: '#667eea',
    },

    // Bouton pour supprimer l'image dans la barre de saisie
    removeInputImageButton: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Conteneur de la barre de saisie interne
    inputToolbarInner: {
        flex: 1,
        width: '100%',
    },

    // Style quand une image est présente
    inputToolbarWithImage: {
        marginTop: 0,
        width: '100%',
    },

    // Conteneur de l'image dans le message
    messageImageContainer: {
        borderRadius: 15,
        overflow: 'hidden',
        marginBottom: 8,
        marginTop: 4,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
        backgroundColor: '#f0f0f0',
    },

    // Image dans le message
    messageImage: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        alignSelf: 'center',
        resizeMode: 'cover',
        aspectRatio: 16/9,
    },

    // Bouton pour agrandir l'image
    expandImageButton: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 20,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
        zIndex: 10,
    },

    // Conteneur du modal pour afficher l'image en plein écran
    fullScreenModalContainer: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Bouton pour fermer le modal
    fullScreenCloseButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 25,
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },

    // Conteneur de l'image en plein écran
    fullScreenImageWrapper: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Image en plein écran
    fullScreenImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },

    // === STYLES POUR L'ASSISTANT VOCAL PLEIN ÉCRAN ===
    
    // Conteneur plein écran (comme ChatGPT)
    voiceFullScreenContainer: {
        flex: 1,
        backgroundColor: '#212121',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    // Header minimal en haut
    voiceFullScreenHeader: {
        width: '100%',
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 20,
        alignItems: 'flex-end',
    },

    // Bouton de fermeture
    voiceCloseButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Zone centrale avec cercle
    voiceCentralZone: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        position: 'relative',
    },

    // Conteneur des anneaux de pulsation
    pulsationContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        width: 400,
        height: 400,
    },

    // Anneaux de pulsation
    pulsationRing: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    
    // Conteneur des ondes sonores
    waveContainer: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: 150,
        height: 80,
    },
    
    // Barres des ondes sonores
    waveBar: {
        width: 6,
        height: 40,
        backgroundColor: '#ef4444',
        marginHorizontal: 4,
        borderRadius: 3,
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 8,
    },

    // Cercle central principal
    centralCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 16,
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },

    // Bouton tactile du cercle central
    centralCircleButton: {
        width: '100%',
        height: '100%',
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Zone de statut sous le cercle
    voiceStatusZone: {
        paddingHorizontal: 40,
        paddingVertical: 30,
        alignItems: 'center',
    },

    // Texte principal du statut
    voiceStatusMainText: {
        fontSize: 18,
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 8,
        fontWeight: '400',
        minHeight: 50, // Hauteur minimale pour éviter les sauts
        lineHeight: 24,
    },

    // Texte "Standard voice"
    voiceStandardText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
    },

    // Conteneur de l'historique de conversation
    voiceConversationContainer: {
        position: 'absolute',
        bottom: 120,
        left: 20,
        right: 20,
        maxHeight: 200,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },

    // ScrollView de l'historique
    voiceConversationScroll: {
        flex: 1,
    },

    // Bulle de message vocal
    voiceMessageBubble: {
        marginVertical: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        maxWidth: '80%',
    },

    // Message utilisateur
    voiceUserMessage: {
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        alignSelf: 'flex-end',
    },

    // Message bot
    voiceBotMessage: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignSelf: 'flex-start',
    },

    // Texte de message vocal
    voiceMessageText: {
        fontSize: 14,
        lineHeight: 18,
    },

    // Texte utilisateur
    voiceUserMessageText: {
        color: '#ffffff',
    },

    // Texte bot
    voiceBotMessageText: {
        color: 'rgba(255, 255, 255, 0.9)',
    },

    // Boutons de contrôle en bas
    voiceControlButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingBottom: 50,
        gap: 20,
    },

    // Bouton de contrôle individuel
    voiceControlButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },

    // Bouton de contrôle actif
    voiceControlButtonActive: {
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
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
                        useNativeDriver: Platform.OS !== 'web'
                    }),
                    Animated.timing(dot2Opacity, {
                        toValue: 1, // Point 2 devient complètement opaque
                        duration: 400,
                        useNativeDriver: Platform.OS !== 'web'
                    }),
                    Animated.timing(dot3Opacity, {
                        toValue: 0.7, // Point 3 devient moyennement opaque
                        duration: 400,
                        useNativeDriver: Platform.OS !== 'web'
                    })
                ]),
                Animated.parallel([ // Deuxième groupe
                    Animated.timing(dot1Opacity, {
                        toValue: 0.7,
                        duration: 400,
                        useNativeDriver: Platform.OS !== 'web'
                    }),
                    Animated.timing(dot2Opacity, {
                        toValue: 0.4,
                        duration: 400,
                        useNativeDriver: Platform.OS !== 'web'
                    }),
                    Animated.timing(dot3Opacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: Platform.OS !== 'web'
                    })
                ]),
                Animated.parallel([ // Troisième groupe
                    Animated.timing(dot1Opacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: Platform.OS !== 'web'
                    }),
                    Animated.timing(dot2Opacity, {
                        toValue: 0.7,
                        duration: 400,
                        useNativeDriver: Platform.OS !== 'web'
                    }),
                    Animated.timing(dot3Opacity, {
                        toValue: 0.4,
                        duration: 400,
                        useNativeDriver: Platform.OS !== 'web'
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
