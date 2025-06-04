import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GlobalApiAuth from '../Services/GlobalApiAuth';

const RegisterScreen = ({ navigation }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const validateForm = () => {
        const newErrors = {};
        
        // Validation de l'email
        if (!formData.email) {
            newErrors.email = 'Veuillez entrer votre adresse email';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Veuillez entrer une adresse email valide (exemple: nom@domaine.com)';
        }

        // Validation du mot de passe
        if (!formData.password) {
            newErrors.password = 'Veuillez entrer un mot de passe';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
            newErrors.password = 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre';
        }

        // Validation de la confirmation du mot de passe
        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Veuillez confirmer votre mot de passe';
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            Alert.alert(
                'Formulaire incomplet',
                'Veuillez remplir correctement tous les champs du formulaire.',
                [{ text: 'OK' }]
            );
            return;
        }

        setLoading(true);
        try {
            const response = await GlobalApiAuth.register(formData.email, formData.password);
            console.log('Réponse d\'inscription:', response);
            
            if (response.needsVerification) {
                Alert.alert(
                    'Inscription réussie',
                    'Un email de vérification a été envoyé à votre adresse. Veuillez vérifier votre boîte mail et cliquer sur le lien de vérification pour activer votre compte.',
                    [{ text: 'OK' }]
                );
                navigation.navigate('VerifyEmail', { email: formData.email });
            } else {
                Alert.alert(
                    'Inscription réussie',
                    'Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.',
                    [{ text: 'OK' }]
                );
                navigation.navigate('Login');
            }
        } catch (error) {
            console.error('Erreur d\'inscription:', error);
            
            // Utiliser directement le message d'erreur de GlobalApiAuth
            Alert.alert(
                'Erreur d\'inscription',
                error.message || 'Une erreur est survenue lors de l\'inscription',
                [{ text: 'OK' }]
            );
            setErrors({ submit: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <LinearGradient
                colors={['#ffffff', '#f5f5f5']}
                style={styles.gradient}
            >
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.navigate('Home')}
                    disabled={loading}
                >
                    <Ionicons name="arrow-back" size={24} color="#4CAF50" />
                </TouchableOpacity>
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <View style={styles.formContainer}>
                        <Image
                            source={require('../../assets/newlogo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />

                        <View style={styles.inputContainer}>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="mail-outline" size={24} color="#4CAF50" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email"
                                    value={formData.email}
                                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>
                            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                        </View>

                        <View style={styles.inputContainer}>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="lock-closed-outline" size={24} color="#4CAF50" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Mot de passe"
                                    value={formData.password}
                                    onChangeText={(text) => setFormData({ ...formData, password: text })}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeIcon}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-off' : 'eye'}
                                        size={24}
                                        color="#4CAF50"
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                        </View>

                        <View style={styles.inputContainer}>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="lock-closed-outline" size={24} color="#4CAF50" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirmer le mot de passe"
                                    value={formData.confirmPassword}
                                    onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                                    secureTextEntry={!showConfirmPassword}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                    style={styles.eyeIcon}
                                >
                                    <Ionicons
                                        name={showConfirmPassword ? 'eye-off' : 'eye'}
                                        size={24}
                                        color="#4CAF50"
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                        </View>

                        {errors.submit && <Text style={styles.errorText}>{errors.submit}</Text>}

                        <TouchableOpacity
                            style={styles.registerButton}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.registerButtonText}>S'inscrire</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.loginLink}
                            onPress={() => navigation.navigate('Login')}
                        >
                            <Text style={styles.loginLinkText}>
                                Déjà un compte ? Se connecter
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </LinearGradient>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    backButton: {
        position: 'absolute',
        top: 40,
        left: 20,
        zIndex: 1,
    },
    formContainer: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    logo: {
        width: 150,
        height: 150,
        alignSelf: 'center',
        marginBottom: 20,
    },
    inputContainer: {
        marginBottom: 15,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#4CAF50',
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    inputIcon: {
        padding: 10,
    },
    input: {
        flex: 1,
        height: 50,
        paddingHorizontal: 10,
        fontSize: 16,
    },
    eyeIcon: {
        padding: 10,
    },
    errorText: {
        color: 'red',
        fontSize: 12,
        marginTop: 5,
    },
    registerButton: {
        backgroundColor: '#4CAF50',
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    registerButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    loginLink: {
        marginTop: 15,
        alignItems: 'center',
    },
    loginLinkText: {
        color: '#4CAF50',
        fontSize: 16,
    },
});

export default RegisterScreen; 