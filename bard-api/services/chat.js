import Conversation from '../models/conversation.js';
import Knowledge from '../models/knowledge.js';
import { logger } from '../lib/utils/logger.js';
import cacheManager from '../lib/cache/index.js';
import monitoring from '../lib/monitoring/index.js';
import contextValidator from '../lib/utils/context-validator.js';

class ChatService {
    constructor() {
        this.conversation = null;
        // Définir les messages spécifiques à Yonetwork
        this.yonetworkIntro = "Bonjour ! Je suis l'assistant virtuel de SoukBot. Je peux vous aider avec des informations sur notre entreprise, nos services, nos horaires ou nos coordonnées. Comment puis-je vous aider aujourd'hui ?";
        this.outOfScopeMessage = "Je suis désolé, mais je suis spécialisé uniquement dans les informations concernant l'entreprise SoukBot. Je ne peux pas répondre à cette question qui semble hors contexte. Puis-je vous aider avec quelque chose concernant SoukBot ?";
        
        // Initialiser le validateur de contexte
        this.initializeContextValidator();
    }
    
    async initializeContextValidator() {
        try {
            await contextValidator.initialize();
            logger.info('Validateur de contexte initialisé avec succès');
        } catch (error) {
            logger.error('Erreur lors de l\'initialisation du validateur de contexte:', error);
        }
    }

    async startConversation(userId) {
        try {
            const startTime = Date.now();
            this.conversation = await Conversation.create(userId);
            
            // Enregistrer le début de la conversation
            monitoring.recordConversationStart();
            
            // Mettre en cache les informations de la conversation
            await cacheManager.set('conversation', this.conversation.id, {
                userId,
                startTime,
                messageCount: 0
            });

            // Ajouter un message d'introduction spécifique à Yonetwork
            await Conversation.addMessage(this.conversation.id, this.yonetworkIntro, 'bot');

            return {
                ...this.conversation,
                initialMessage: this.yonetworkIntro
            };
        } catch (error) {
            logger.error('Error starting conversation:', error);
            monitoring.recordError('conversation_start', 'chat_service');
            throw error;
        }
    }

    async sendMessage(userId, content) {
        try {
            if (!this.conversation) {
                await this.startConversation(userId);
            }

            const startTime = Date.now();

            // Enregistrer le message de l'utilisateur
            await Conversation.addMessage(this.conversation.id, content, 'user');
            
            // 1. Première étape : analyse sémantique pour vérifier le contexte
            const contextValidation = await contextValidator.validateContext(content);
            logger.info(`Validation de contexte: ${JSON.stringify({
                query: content,
                isInContext: contextValidation.isInContext,
                confidence: contextValidation.confidence,
                threshold: contextValidation.threshold,
                bestMatch: contextValidation.bestMatch,
                bestSimilarity: contextValidation.bestSimilarity,
                containsGeneralKeywords: contextValidation.containsGeneralKeywords || false,
                irrelevantSimilarity: contextValidation.irrelevantSimilarity || 0,
                irrelevantWeight: contextValidation.irrelevantWeight || 0
            })}`);
            
            // 2. Deuxième étape : recherche dans la base de connaissances avec mots-clés spécifiques
            let knowledgeResults = [];
            
            // Liste de mots-clés pertinents à rechercher pour certaines requêtes spécifiques
            const keywordMappings = {
                'contact': ['contact', 'coordonnées', 'adresse', 'téléphone', 'email'],
                'nous contacter': ['contact', 'coordonnées', 'adresse', 'téléphone', 'email'],
                'horaires': ['horaires', 'ouverture', 'fermeture', 'disponibilité'],
                'services': ['services', 'offres', 'solutions', 'prestations'],
                'tarifs': ['tarifs', 'prix', 'coût', 'abonnement'],
                'adresse': ['adresse', 'localisation', 'bureaux', 'siège']
            };
            
            // Normaliser la requête pour la recherche de mots-clés
            const normalizedQuery = content.toLowerCase().trim();
            
            // Vérifier si la requête correspond à l'une des requêtes spécifiques
            const matchedKeyword = Object.keys(keywordMappings).find(key => 
                normalizedQuery.includes(key.toLowerCase())
            );
            
            // Si on a une correspondance directe, utiliser les mots-clés associés pour la recherche
            if (matchedKeyword) {
                logger.info(`Requête spécifique détectée: "${matchedKeyword}", utilisation de mots-clés spécifiques pour la recherche`);
                
                // Effectuer plusieurs recherches avec les mots-clés spécifiques
                for (const keyword of keywordMappings[matchedKeyword]) {
                    const results = await Knowledge.search(keyword);
                    if (results.length > 0) {
                        knowledgeResults = [...knowledgeResults, ...results];
                        // Limiter à 5 résultats maximum
                        if (knowledgeResults.length >= 5) {
                            knowledgeResults = knowledgeResults.slice(0, 5);
                            break;
                        }
                    }
                }
                
                // Tentative supplémentaire avec la catégorie directement
                if (knowledgeResults.length === 0) {
                    const categoryResults = await Knowledge.getByCategory(matchedKeyword.charAt(0).toUpperCase() + matchedKeyword.slice(1));
                    if (categoryResults && categoryResults.length > 0) {
                        knowledgeResults = categoryResults.slice(0, 5);
                    }
                }
            } 
            
            // Si pas de correspondance directe ou pas de résultats, faire une recherche standard
            if (knowledgeResults.length === 0) {
                knowledgeResults = await Knowledge.search(content);
            }
            
            logger.info(`Résultats de la recherche dans la base de connaissances:`, {
                query: content,
                resultCount: knowledgeResults.length,
                topResults: knowledgeResults.slice(0, 2).map(r => r.title)
            });
            
            // 3. Prise de décision intelligente combinant les deux approches
            const hasRelevantKnowledge = knowledgeResults.length > 0 && 
                      !knowledgeResults[0].title.toLowerCase().includes('hors contexte');
            
            // Critères renforcés pour la détection des questions hors contexte          
            const isDefinitelyOutOfContext = 
                !contextValidation.isInContext || 
                contextValidation.containsGeneralKeywords || 
                (contextValidation.confidence < 30 && !hasRelevantKnowledge) ||
                (contextValidation.irrelevantSimilarity * contextValidation.irrelevantWeight > 0.4) ||
                // Vérifier si la requête contient des termes spécifiques à la géographie ou à d'autres sujets hors contexte
                (normalizedQuery.includes('capitale') && !normalizedQuery.includes('yonetwork')) ||
                (normalizedQuery.includes('pays') && !normalizedQuery.includes('yonetwork'));
            
            // Logs détaillés sur la décision
            logger.info(`Analyse de pertinence combinée:`, {
                isDefinitelyOutOfContext,
                hasRelevantKnowledge,
                semanticDecision: contextValidation.isInContext ? 'PERTINENT' : 'NON PERTINENT',
                confidence: contextValidation.confidence,
                threshold: contextValidation.threshold,
                containsGeneralKeywords: contextValidation.containsGeneralKeywords || false,
                irrelevantSimilarity: contextValidation.irrelevantSimilarity,
                irrelevantWeight: contextValidation.irrelevantWeight,
                topIrrelevantMatches: contextValidation.topIrrelevantMatches || []
            });
                
            // Apprendre de cette interaction - stocker la question et sa classification
            const learnAsRelevant = hasRelevantKnowledge && !isDefinitelyOutOfContext;
            
            // Utiliser l'apprentissage pour améliorer le modèle
            contextValidator.learnFromQuery(content, learnAsRelevant, {
                confidence: contextValidation.confidence,
                hasKnowledgeResults: hasRelevantKnowledge,
                knowledgeResultsCount: knowledgeResults.length,
                semanticEvaluation: contextValidation.isInContext,
                containsGeneralKeywords: contextValidation.containsGeneralKeywords || false,
                timestamp: new Date().toISOString()
            });
            
            // Décision finale : répondre ou rejeter la question
            if (isDefinitelyOutOfContext) {
                logger.warn(`Question hors contexte détectée: "${content}" - Score: ${contextValidation.confidence}%, Résultats base de connaissances: ${knowledgeResults.length}, Contient mots-clés généraux: ${contextValidation.containsGeneralKeywords || false}`);
                
                // Passer la requête originale pour personnaliser la réponse
                const outOfScopeResponse = contextValidator.getOutOfScopeResponse(content);
                
                // Enregistrer la réponse "hors contexte"
                await Conversation.addMessage(this.conversation.id, outOfScopeResponse, 'bot');
                
                // Mettre à jour les métriques
                const conversationCache = await cacheManager.get('conversation', this.conversation.id);
                if (conversationCache) {
                    conversationCache.messageCount += 2;
                    await cacheManager.set('conversation', this.conversation.id, conversationCache);
                }
                
                // Enregistrer la métrique de question hors contexte
                monitoring.recordOutOfContextQuery(content);
                
                return {
                    conversationId: this.conversation.id,
                    reply: outOfScopeResponse,
                    isOutOfContext: true,
                    contextValidation
                };
            }

            // Traitement des questions dans le contexte
            // Vérifier le cache pour la réponse
            const cacheKey = `message:${this.conversation.id}:${content}`;
            let botResponse = await cacheManager.get('knowledge', cacheKey);

            if (!botResponse) {
                const searchStart = Date.now();
                const searchDuration = (Date.now() - searchStart) / 1000;

                // Enregistrer les métriques de recherche
                monitoring.recordKnowledgeSearch(
                    searchDuration,
                    knowledgeResults.length,
                    false
                );

                // Générer une réponse basée sur les résultats
                if (knowledgeResults.length > 0) {
                    // Même si la validation sémantique a donné un score faible, 
                    // si nous avons des résultats pertinents, on répond quand même
                    const bestMatch = knowledgeResults[0];
                    
                    // Formater la réponse en fonction du type de contenu
                    if (bestMatch.content.startsWith('mailto:')) {
                        // C'est une adresse email
                        const email = bestMatch.content.replace('mailto:', '');
                        botResponse = `**${bestMatch.title}**\n\nVous pouvez nous contacter par email à l'adresse suivante: ${email}\n\nNotre équipe se fera un plaisir de vous répondre dans les plus brefs délais.`;
                    } else if (bestMatch.content.match(/^\+?[\d\s()-]{7,}$/)) {
                        // C'est un numéro de téléphone
                        botResponse = `**${bestMatch.title}**\n\nVous pouvez nous joindre par téléphone au ${bestMatch.content}\n\nNos conseillers sont disponibles pour répondre à vos questions.`;
                    } else {
                        // Contenu standard
                        botResponse = `**${bestMatch.title}**  \n\n${bestMatch.content}`;
                    }
                    
                    // Ajouter des informations supplémentaires si disponibles
                    if (knowledgeResults.length > 1) {
                        botResponse += '\n\n**Autres informations pertinentes :**';
                        knowledgeResults.slice(1, 3).forEach(result => {
                            botResponse += `\n- ${result.title}`;
                        });
                    }
                } else {
                    // Pas de résultats, mais la question est jugée pertinente sémantiquement
                    botResponse = "Je n'ai pas trouvé d'informations spécifiques sur ce sujet dans notre base de connaissances sur SoukBot. Pourriez-vous reformuler votre question ou me demander autre chose concernant notre entreprise ?";
                }

                // Mettre en cache la réponse
                await cacheManager.set('knowledge', cacheKey, botResponse);
            } else {
                // Enregistrer un hit de cache
                monitoring.recordKnowledgeSearch(0, 1, true);
            }

            // Enregistrer la réponse du bot
            await Conversation.addMessage(this.conversation.id, botResponse, 'bot');

            // Mettre à jour les métriques de la conversation
            const conversationCache = await cacheManager.get('conversation', this.conversation.id);
            if (conversationCache) {
                conversationCache.messageCount += 2; // +2 pour le message utilisateur et la réponse
                await cacheManager.set('conversation', this.conversation.id, conversationCache);
            }

            return {
                conversationId: this.conversation.id,
                reply: botResponse,
                isOutOfContext: false,
                contextValidation: {
                    isInContext: true,
                    confidence: contextValidation.confidence
                }
            };
        } catch (error) {
            logger.error('Error sending message:', error);
            monitoring.recordError('message_send', 'chat_service');
            throw error;
        }
    }

    async getConversationHistory(conversationId) {
        try {
            // Vérifier le cache
            const cachedHistory = await cacheManager.get('conversation', `history:${conversationId}`);
            if (cachedHistory) {
                return cachedHistory;
            }

            const conversation = await Conversation.findById(conversationId);
            if (!conversation) {
                throw new Error('Conversation not found');
            }

            const messages = await Conversation.getMessages(conversationId);
            const history = {
                conversation,
                messages
            };

            // Mettre en cache l'historique
            await cacheManager.set('conversation', `history:${conversationId}`, history);

            return history;
        } catch (error) {
            logger.error('Error getting conversation history:', error);
            monitoring.recordError('history_get', 'chat_service');
            throw error;
        }
    }

    async endConversation(conversationId) {
        try {
            const conversation = await Conversation.findById(conversationId);
            if (!conversation) {
                throw new Error('Conversation not found');
            }

            const messages = await Conversation.getMessages(conversationId);
            const duration = (Date.now() - new Date(conversation.start_time).getTime()) / 1000;

            // Enregistrer les métriques de fin de conversation
            monitoring.recordConversationEnd(duration, messages.length);

            // Nettoyer le cache
            await cacheManager.delete('conversation', conversationId);
            await cacheManager.delete('conversation', `history:${conversationId}`);

            return await Conversation.updateStatus(conversationId, 'closed');
        } catch (error) {
            logger.error('Error ending conversation:', error);
            monitoring.recordError('conversation_end', 'chat_service');
            throw error;
        }
    }

    async getActiveConversations() {
        try {
            // Vérifier le cache
            const cachedActive = await cacheManager.get('conversation', 'active');
            if (cachedActive) {
                return cachedActive;
            }

            const activeConversations = await Conversation.getActiveConversations();
            
            // Mettre en cache les conversations actives
            await cacheManager.set('conversation', 'active', activeConversations, 60); // TTL de 1 minute

            return activeConversations;
        } catch (error) {
            logger.error('Error getting active conversations:', error);
            monitoring.recordError('active_conversations_get', 'chat_service');
            throw error;
        }
    }
}

const chatService = new ChatService();
export default chatService; 