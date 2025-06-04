import db from '../lib/db/index';
import { logger } from '../lib/utils/logger';
import { compressMessage, decompressMessage } from '../lib/utils/compression';

class Conversation {
    static async create(userId) {
        try {
            return await db.one(
                `INSERT INTO conversations (user_id, status)
                 VALUES ($1, 'active')
                 RETURNING id, user_id, status, start_time`,
                [userId]
            );
        } catch (error) {
            logger.error('Error creating conversation:', error);
            throw error;
        }
    }

    static async findById(id) {
        try {
            return await db.oneOrNone(
                `SELECT c.id, c.user_id, c.status, c.start_time, c.end_time, c.metadata,
                        u.email as user_email, u.name as user_name
                 FROM conversations c
                 LEFT JOIN users u ON c.user_id = u.id
                 WHERE c.id = $1`,
                [id]
            );
        } catch (error) {
            logger.error('Error finding conversation:', error);
            throw error;
        }
    }

    static async findByUserId(userId) {
        try {
            return await db.any(
                `SELECT c.id, c.status, c.start_time, c.end_time,
                        COUNT(m.id) as message_count
                 FROM conversations c
                 LEFT JOIN messages m ON c.id = m.conversation_id
                 WHERE c.user_id = $1
                 GROUP BY c.id
                 ORDER BY c.start_time DESC`,
                [userId]
            );
        } catch (error) {
            logger.error('Error finding user conversations:', error);
            throw error;
        }
    }

    static async updateStatus(id, status) {
        try {
            return await db.one(
                `UPDATE conversations
                 SET status = $1,
                     end_time = CASE WHEN $1 = 'closed' THEN CURRENT_TIMESTAMP ELSE end_time END
                 WHERE id = $2
                 RETURNING id, status, end_time`,
                [status, id]
            );
        } catch (error) {
            logger.error('Error updating conversation status:', error);
            throw error;
        }
    }

    static async addMessage(conversationId, content, senderType) {
        try {
            // Compresser le message avant de le stocker
            const compressedContent = await compressMessage(content);
            
            return await db.one(
                `INSERT INTO messages (conversation_id, content, sender_type)
                 VALUES ($1, $2, $3)
                 RETURNING id, content, sender_type, timestamp`,
                [conversationId, compressedContent, senderType]
            );
        } catch (error) {
            logger.error('Error adding message:', error);
            throw error;
        }
    }

    static async getMessages(conversationId, page = 1, limit = 50) {
        try {
            const offset = (page - 1) * limit;
            
            const totalCount = await db.one(
                `SELECT COUNT(*) as total
                 FROM messages
                 WHERE conversation_id = $1`,
                [conversationId]
            );

            const messages = await db.any(
                `SELECT id, content, sender_type, timestamp
                 FROM messages
                 WHERE conversation_id = $1
                 ORDER BY timestamp ASC
                 LIMIT $2 OFFSET $3`,
                [conversationId, limit, offset]
            );

            // Décompresser les messages
            const decompressedMessages = await Promise.all(
                messages.map(async (message) => ({
                    ...message,
                    content: await decompressMessage(message.content)
                }))
            );

            return {
                messages: decompressedMessages,
                pagination: {
                    total: parseInt(totalCount.total),
                    page,
                    limit,
                    totalPages: Math.ceil(totalCount.total / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting conversation messages:', error);
            throw error;
        }
    }

    static async getActiveConversations() {
        try {
            return await db.any(
                `SELECT c.id, c.user_id, c.start_time,
                        u.email as user_email, u.name as user_name,
                        COUNT(m.id) as message_count
                 FROM conversations c
                 LEFT JOIN users u ON c.user_id = u.id
                 LEFT JOIN messages m ON c.id = m.conversation_id
                 WHERE c.status = 'active'
                 GROUP BY c.id, u.email, u.name
                 ORDER BY c.start_time DESC`
            );
        } catch (error) {
            logger.error('Error getting active conversations:', error);
            throw error;
        }
    }
}

export default Conversation; 