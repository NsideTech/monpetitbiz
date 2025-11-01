# 🔧 Database Connection Troubleshooting - MonPetitBiz

## Erreurs Courantes

### ❌ Error: `getaddrinfo ENOTFOUND db.xxx.supabase.co`

Cette erreur signifie que le nom de domaine Supabase ne peut pas être résolu par DNS. Le projet Supabase n'existe probablement pas, a été supprimé, ou l'URL est incorrecte.

### ❌ Error: TCP connection failed (Port 5432)

Le DNS résout correctement, mais la connexion TCP sur le port 5432 échoue. Causes probables : projet en pause, port bloqué, ou utilisation du mauvais port.

**Solution rapide : Utiliser le port pooler (6543)**

```bash
# Modifier DATABASE_URL pour utiliser le port 6543
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1"
```

Voir ci-dessous pour plus de détails.

## 🔍 Diagnostic Rapide

Exécutez le script de diagnostic :

```bash
./scripts/check-database-connection.sh
```

## 🛠️ Solutions

### Option 1: Vérifier votre projet Supabase

1. **Aller sur le dashboard Supabase**
   ```bash
   https://supabase.com/dashboard
   ```

2. **Vérifier que votre projet existe**
   - Le projet doit être **actif** (pas suspendu/pausé)
   - Le nom du projet doit correspondre à l'URL

3. **Récupérer la bonne URL de connexion**
   - Settings → Database → Connection string
   - Copier la "Connection String" (format URI)

4. **Mettre à jour DATABASE_URL**
   ```bash
   export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   ```

### Option 2: Créer un nouveau projet Supabase

1. **Aller sur Supabase**
   - https://supabase.com
   - Créer un compte (si nécessaire)

2. **Créer un nouveau projet**
   - Click "New Project"
   - Choisir une région (ex: Europe West pour l'Afrique)
   - Noter le **Project Reference** et le **Database Password**

3. **Configurer DATABASE_URL**
   ```bash
   export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
   ```

4. **Tester la connexion**
   ```bash
   ./scripts/check-database-connection.sh
   ```

5. **Exécuter les migrations**
   ```bash
   npm run migration:run
   ```

### Option 3: Utiliser une base de données locale

Si vous préférez travailler en local pendant le développement :

1. **Installer PostgreSQL** (si pas déjà installé)
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql
   
   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   sudo systemctl start postgresql
   ```

2. **Configurer la base locale**
   ```bash
   ./scripts/setup-database.sh
   ```

3. **Mettre à jour DATABASE_URL** (dans `.env` ou export)
   ```bash
   export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/monpetitbiz"
   # Ou utilisez les variables individuelles
   export DATABASE_HOST="localhost"
   export DATABASE_PORT="5432"
   export DATABASE_USERNAME="postgres"
   export DATABASE_PASSWORD="postgres"
   export DATABASE_NAME="monpetitbiz"
   ```

4. **Exécuter les migrations**
   ```bash
   npm run migration:run
   ```

## 📋 Vérifications Courantes

### ✅ Vérifier que DATABASE_URL est définie

```bash
echo $DATABASE_URL
```

Si vide, définir :
```bash
export DATABASE_URL="postgresql://..."
# Ou ajouter dans .env
echo 'DATABASE_URL="postgresql://..."' >> .env
```

### ✅ Vérifier la résolution DNS

```bash
nslookup db.[YOUR-PROJECT-REF].supabase.co
```

Si échec DNS, le projet n'existe probablement pas.

### ✅ Tester la connexion PostgreSQL

```bash
psql "$DATABASE_URL" -c "SELECT version();"
```

### ✅ Vérifier le format de l'URL

Format attendu :
```
postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
```

Exemple Supabase :
```
postgresql://postgres:your_password@db.abcdefghijklmnop.supabase.co:5432/postgres
```

## 🚨 Erreurs Courantes

### 1. "getaddrinfo ENOTFOUND"
**Cause**: Le domaine n'existe pas  
**Solution**: Vérifier/créer le projet Supabase

### 2. "connection timeout"
**Cause**: Problème réseau ou port bloqué  
**Solution**: 
- Vérifier votre connexion internet
- Vérifier le pare-feu
- Essayer le port 5432 (direct) au lieu de 6543 (pooler)

### 3. "password authentication failed"
**Cause**: Mot de passe incorrect  
**Solution**: Vérifier le mot de passe dans le dashboard Supabase

### 4. "database does not exist"
**Cause**: Nom de base incorrect  
**Solution**: Pour Supabase, utilisez `postgres` comme nom de base

### 5. "SSL connection required"
**Cause**: SSL non configuré  
**Solution**: Utiliser `?sslmode=require` dans l'URL ou configurer SSL dans TypeORM

## 💡 Conseils

1. **Toujours tester la connexion avant de lancer l'app**
   ```bash
   ./scripts/check-database-connection.sh
   ```

2. **Utiliser `.env` pour les variables sensibles**
   ```bash
   # Créer .env (ne pas commiter)
   cp .env.example .env
   # Ajouter DATABASE_URL dans .env
   ```

3. **Pour Supabase**, utilisez le port **5432** (direct) pour le développement
   - Port 5432 : Connexion directe (recommandé pour dev)
   - Port 6543 : Connection pooling (pour production)

4. **Vérifier que le projet Supabase est actif**
   - Dashboard → Project Settings
   - Status doit être "Active"

## 📞 Support

Si le problème persiste :
1. Vérifier les logs Supabase : Dashboard → Logs
2. Vérifier votre projet n'est pas en pause
3. Créer un nouveau projet Supabase si nécessaire


