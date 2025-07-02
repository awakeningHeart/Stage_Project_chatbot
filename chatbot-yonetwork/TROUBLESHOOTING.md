# 🔧 Guide de Dépannage - Écran Blanc

## 🚨 Problème: Écran blanc au démarrage

### Solutions rapides à essayer :

### 1. **Vérifier la console du navigateur**
1. Ouvrez les outils de développement (F12)
2. Allez dans l'onglet "Console"
3. Recherchez les erreurs en rouge
4. Notez les messages d'erreur pour les étapes suivantes

### 2. **Redémarrer l'application**
```bash
# Arrêter l'application (Ctrl+C dans le terminal)
# Puis redémarrer avec :
cd Stage_Project_chatbot/chatbot-yonetwork
npm start
# ou
npx expo start --web
```

### 3. **Vider le cache**
1. Dans le navigateur : Ctrl+Shift+R (rechargement forcé)
2. Ou vider le cache manuellement :
   - Ouvrir les outils dev (F12)
   - Clic droit sur le bouton de rechargement
   - Choisir "Vider le cache et recharger"

### 4. **Vérifier les dépendances**
```bash
cd Stage_Project_chatbot/chatbot-yonetwork
npm install
# ou en cas de problème :
rm -rf node_modules package-lock.json
npm install
```

### 5. **Mode debug activé**
L'application a maintenant un mode debug intégré qui devrait afficher :
- Les étapes de chargement
- Les erreurs détaillées
- Les informations de diagnostic

### 6. **Problèmes courants et solutions**

#### ❌ **Erreur : "ChatFaceData manquant"**
**Solution :** Le fichier `ChatFaceData.js` a été corrigé. Redémarrez l'app.

#### ❌ **Erreur : "Cannot connect to server"**
**Solutions :**
1. Vérifiez que le serveur backend est démarré
2. Changez l'URL dans `environment.js` :
```javascript
// Dans App/config/environment.js, ligne ~10
const getBaseUrl = () => {
    if (Platform.OS === 'web') {
        return 'http://localhost:3000';  // Ou votre URL serveur
    }
    // ...
};
```

#### ❌ **Erreur : "Module not found"**
**Solution :** Réinstallez les dépendances :
```bash
npm install --force
```

#### ❌ **Erreur de CORS**
**Solution :** Démarrez le serveur backend avec les bonnes configurations CORS.

### 7. **Test de diagnostic manuel**

Ouvrez la console et testez :
```javascript
// Test 1: Vérifier ChatFaceData
console.log('Test ChatFaceData:', typeof window.ChatFaceData);

// Test 2: Vérifier React
console.log('Test React:', typeof React);

// Test 3: Vérifier les APIs vocales
console.log('Speech Recognition:', 'webkitSpeechRecognition' in window);
console.log('Speech Synthesis:', 'speechSynthesis' in window);
```

### 8. **Utiliser la page de debug**
1. Naviguez vers : `http://localhost:8081/debug.html`
2. Cliquez sur "Diagnostic complet"
3. Exportez les logs si nécessaire

### 9. **Vérification de l'environnement**

Assurez-vous que votre configuration correspond à :
- **Node.js** : version 16+ 
- **npm** : version 8+
- **Navigateur** : Chrome, Firefox, Edge (dernières versions)

### 10. **Si rien ne fonctionne**

#### Réinitialisation complète :
```bash
# 1. Nettoyer complètement
cd Stage_Project_chatbot/chatbot-yonetwork
rm -rf node_modules
rm package-lock.json

# 2. Réinstaller
npm install

# 3. Relancer
npm start
```

#### Mode de récupération :
L'application inclut maintenant un mode de récupération qui :
- Affiche les erreurs de manière claire
- Permet de continuer avec des fonctionnalités limitées
- Fournit des informations de debug détaillées

### 📊 Informations de debug à fournir

Si le problème persiste, notez ces informations :
1. **Messages d'erreur dans la console**
2. **Version du navigateur**
3. **Système d'exploitation**
4. **Messages dans le terminal**
5. **Capture d'écran de l'erreur**

### 🆘 Support

Les améliorations apportées incluent :
- ✅ Correction de l'export ChatFaceData
- ✅ Mode debug intégré
- ✅ Gestion d'erreurs robuste
- ✅ Mode de récupération
- ✅ Informations de diagnostic
- ✅ Page de test indépendante

L'application devrait maintenant se charger correctement et afficher des informations utiles en cas de problème. 