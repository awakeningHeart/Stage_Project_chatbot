import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'chat_cache_';
const DEFAULT_TTL = 3600000; // 1 heure

export const CacheService = {
    async setCache(key, data, ttl = DEFAULT_TTL) {
        const item = {
            data,
            timestamp: Date.now(),
            ttl
        };
        try {
            await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
        } catch (error) {
            console.error('Erreur lors de la mise en cache:', error);
        }
    },

    async getCache(key) {
        try {
            const item = await AsyncStorage.getItem(CACHE_PREFIX + key);
            if (!item) return null;

            const { data, timestamp, ttl } = JSON.parse(item);
            if (Date.now() - timestamp > ttl) {
                await this.removeCache(key);
                return null;
            }
            return data;
        } catch (error) {
            console.error('Erreur lors de la récupération du cache:', error);
            return null;
        }
    },

    async removeCache(key) {
        try {
            await AsyncStorage.removeItem(CACHE_PREFIX + key);
        } catch (error) {
            console.error('Erreur lors de la suppression du cache:', error);
        }
    },

    async clearAllCache() {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
            await AsyncStorage.multiRemove(cacheKeys);
        } catch (error) {
            console.error('Erreur lors du nettoyage du cache:', error);
        }
    }
}; 