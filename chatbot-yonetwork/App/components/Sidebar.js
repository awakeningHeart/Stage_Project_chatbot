import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Text, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AuthStorage from '../Services/AuthStorage';
import HistoryFavorites from './HistoryFavorites';

const Sidebar = ({ isVisible, onClose }) => {
    const navigation = useNavigation();
    const [user, setUser] = useState(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    useEffect(() => {
        if (isVisible) {
            loadUserData();
        }
    }, [isVisible]);

    const loadUserData = async () => {
        try {
            const userData = await AuthStorage.getUser();
            console.log("Données utilisateur chargées:", userData);
            setUser(userData);
        } catch (error) {
            console.error('Erreur lors du chargement des données utilisateur:', error);
        }
    };

    // Fonction qui effectue réellement la déconnexion
    const performLogout = async () => {
        try {
            console.log("Déconnexion en cours...");
            setIsLoggingOut(true);
            setShowLogoutConfirm(false);
            
            // Fermer la barre latérale
            if (onClose) {
                console.log("Fermeture de la barre latérale");
                onClose();
            }
            
            // Utiliser la méthode logout d'AuthStorage qui gère la déconnexion côté serveur et client
            await AuthStorage.logout();
            console.log("Déconnexion réussie");
            
            // Redirection vers l'écran de connexion
            console.log("Redirection vers l'écran d'accueil");
            
            // Attendre un court instant pour montrer l'animation de chargement
            setTimeout(() => {
                try {
                    // Naviguer vers Home avec reset pour éviter le retour en arrière
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'Home' }],
                    });
                } catch (error) {
                    console.error("Erreur lors de la navigation:", error);
                    Alert.alert(
                        "Erreur",
                        "Une erreur est survenue lors de la navigation. Veuillez redémarrer l'application."
                    );
                }
            }, 800); // Délai pour montrer l'animation de chargement
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
            Alert.alert(
                "Erreur",
                "Une erreur est survenue lors de la déconnexion. Veuillez réessayer."
            );
            setIsLoggingOut(false);
        }
    };

    const handleLogoutPress = () => {
        setShowLogoutConfirm(true);
    };

    const cancelLogout = () => {
        console.log("Déconnexion annulée");
        setShowLogoutConfirm(false);
    };

    // Si la sidebar n'est pas visible, ne rien rendre
    if (!isVisible) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.contentContainer}>
                <ScrollView style={styles.scrollView}>
                    <View style={styles.profileSection}>
                        <Image
                            source={user?.avatar ? { uri: user.avatar } : require('../../assets/newlogo.png')}
                            style={styles.avatar}
                        />
                        <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
                        <Text style={styles.userEmail}>{user?.email || ''}</Text>
                    </View>

                    <View style={styles.navigationSection}>
                        <TouchableOpacity 
                            style={styles.navItem}
                            onPress={() => {
                                navigation.navigate('Home');
                                onClose();
                            }}
                        >
                            <MaterialIcons name="home" size={24} color="#4CAF50" />
                            <Text style={styles.navText}>Accueil</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.navItem}
                            onPress={() => {
                                navigation.navigate('Chat', { 
                                    selectedFace: {
                                        id: 1,
                                        name: "Chatbot Yonetwork",
                                        image: "https://img.freepik.com/premium-vector/mascot-robot-pack_844941-9.jpg?ga=GA1.1.2115268387.1745576145&semt=ais_hybrid&w=740"
                                    },
                                    resetConversation: true
                                });
                                onClose();
                            }}
                        >
                            <MaterialIcons name="chat" size={24} color="#4CAF50" />
                            <Text style={styles.navText}>Nouvelle conversation</Text>
                        </TouchableOpacity>

                        <View style={styles.historySection}>
                            <Text style={styles.sectionTitle}>Historique & Réseaux Sociaux</Text>
                            <HistoryFavorites />
                        </View>
                    </View>

                    {/* Confirmation de déconnexion personnalisée */}
                    {showLogoutConfirm && (
                        <View style={styles.confirmContainer}>
                            <View style={styles.confirmBox}>
                                <Text style={styles.confirmTitle}>Déconnexion</Text>
                                <Text style={styles.confirmText}>Êtes-vous sûr de vouloir vous déconnecter ?</Text>
                                <View style={styles.confirmButtons}>
                                    <TouchableOpacity 
                                        style={[styles.confirmButton, styles.cancelButton]}
                                        onPress={cancelLogout}
                                    >
                                        <Text style={styles.cancelButtonText}>Annuler</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.confirmButton, styles.confirmLogoutButton]}
                                        onPress={performLogout}
                                    >
                                        <Text style={styles.confirmLogoutText}>Déconnecter</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Bouton de déconnexion amélioré avec indicateur de chargement */}
                    <View style={styles.footerContainer}>
                    <TouchableOpacity 
                            style={[
                                styles.logoutButton,
                                isLoggingOut && styles.logoutButtonDisabled
                            ]}
                            onPress={handleLogoutPress}
                            disabled={isLoggingOut}
                        >
                            {isLoggingOut ? (
                                <>
                                    <ActivityIndicator size="small" color="#fff" />
                                    <Text style={styles.logoutText}>Déconnexion en cours...</Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="log-out-outline" size={24} color="#fff" />
                                    <Text style={styles.logoutText}>Déconnexion</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        </View>
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    contentContainer: {
        flex: 1,
        paddingTop: 40, // Ajout d'un espacement en haut pour compenser la suppression du header
    },
    scrollView: {
        flex: 1,
    },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 20,
        backgroundColor: '#f8f9fa',
        marginHorizontal: 10,
        marginTop: 10,
        borderRadius: 10,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 10,
        backgroundColor: '#f0f0f0',
    },
    userName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
    },
    navigationSection: {
        padding: 15,
        flex: 1,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 8,
        marginBottom: 5,
    },
    navText: {
        marginLeft: 15,
        fontSize: 16,
        color: '#333',
    },
    historySection: {
        marginTop: 20,
        marginBottom: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 15,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 15,
        paddingHorizontal: 15,
    },
    footerContainer: {
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        paddingVertical: 15,
        paddingHorizontal: 20,
        marginTop: 'auto'
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF5252',
        borderRadius: 10,
        padding: 15,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    logoutButtonDisabled: {
        backgroundColor: '#FF8A80',
        opacity: 0.7,
    },
    logoutText: {
        color: '#fff',
        marginLeft: 10,
        fontSize: 16,
        fontWeight: '600',
    },
    // Styles pour la confirmation personnalisée
    confirmContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
    },
    confirmBox: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        width: '80%',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    confirmTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    confirmText: {
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
    },
    confirmButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    confirmButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        flex: 1,
        marginHorizontal: 5,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f0f0f0',
    },
    confirmLogoutButton: {
        backgroundColor: '#FF5252',
    },
    cancelButtonText: {
        color: '#333',
    },
    confirmLogoutText: {
        color: 'white',
        fontWeight: 'bold',
    },
});

export default Sidebar; 