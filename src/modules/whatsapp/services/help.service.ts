import { Injectable } from '@nestjs/common';

export interface HelpContext {
  userRole?: 'owner' | 'seller' | 'manager';
  businessName?: string;
  language?: string;
  isAuthenticated: boolean;
}

@Injectable()
export class HelpService {

  /**
   * Get comprehensive help message based on user context
   */
  getHelpMessage(category: string = 'general', context: HelpContext): string {
    const language = context.language || 'fr';

    // if (language === 'wo') {
    //   return this.getWolofHelpMessage(category, context);
    // }

    return this.getFrenchHelpMessage(category, context);
  }

  /**
   * Get French help messages
   */
  private getFrenchHelpMessage(category: string, context: HelpContext): string {
    const { userRole, businessName, isAuthenticated } = context;

    if (!isAuthenticated) {
      return this.getUnauthenticatedHelpMessage();
    }

    switch (category) {
      case 'sales':
        return this.getSalesHelpMessage(userRole);
      
      case 'expenses':
        return this.getExpensesHelpMessage(userRole);
      
      case 'stock':
        return this.getStockHelpMessage(userRole);
      
      case 'prix':
      case 'price':
      case 'prices':
        return this.getPriceHelpMessage(userRole);
      
      case 'reports':
        return this.getReportsHelpMessage(userRole);
      
      case 'commands':
        return this.getCommandsHelpMessage(userRole);
      
      case 'units':
        return this.getUnitsHelpMessage(userRole);
      
      case 'general':
      default:
        return this.getGeneralHelpMessage(userRole, businessName);
    }
  }

  /**
   * Get Wolof help messages
   */
  // private getWolofHelpMessage(category: string, context: HelpContext): string {
  //   const { userRole } = context;

  //   switch (category) {
  //     case 'sales':
  //       return `🛒 **JAAY (Ventes)**\n\n` +
  //              `• "jaay 1000" - jaay bu 1000 CFA\n` +
  //              `• "jaay mburu 500" - jaay mburu ci 500 CFA\n` +
  //              `• "man jaay ceeb 2000" - man jaay ceeb ci 2000 CFA\n\n` +
  //              `💡 Wax "ndimbal jaay" ngir gën wax yu bari.`;

  //     case 'general':
  //     default:
  //       return `👋 **NDIMBAL (Aide)**\n\n` +
  //              `🛒 **Jaay (Ventes):** "jaay 1000 mburu"\n` +
  //              `💸 **Jënd (Achats):** "jënd 500 ataya"\n` +
  //              `📦 **Stock:** "stock mburu 10"\n` +
  //              `📊 **Bilan:** "bilan tey"\n\n` +
  //              `💡 Wax "ndimbal" ak sa bëgg-bëgg ngir gën ndimbal yu bari.`;
  //   }
  // }

  /**
   * Help for unauthenticated users
   */
  private getUnauthenticatedHelpMessage(): string {
    return `👋 **Bienvenue dans MonPetitBiz !**\n\n` +
           `Pour utiliser ce service, vous devez d'abord créer votre compte.\n\n` +
           `🏢 **Pour créer une entreprise :**\n` +
           `Tapez "créer une nouvelle entreprise"\n\n` +
           `👤 **Pour rejoindre une entreprise :**\n` +
           `Tapez "bonjour" puis choisissez "Employé"\n\n` +
           `💡 **Besoin d'aide ?**\n` +
           `Tapez "aide" à tout moment pour obtenir de l'assistance.`;
  }

  /**
   * General help message for authenticated users
   */
  private getGeneralHelpMessage(userRole?: string, businessName?: string): string {
    const roleText = this.getRoleText(userRole);
    const businessText = businessName ? `\n🏢 **Entreprise :** ${businessName}` : '';

    let message = `👋 **Aide MonPetitBiz**${businessText}\n👤 **Rôle :** ${roleText}\n\n`;

    message += `🚀 **COMMANDES PRINCIPALES**\n\n`;

    // Sales commands (available to all roles)
    message += `🛒 **VENTES**\n`;
    message += `• "vente 1000" - Enregistrer une vente de 1000 CFA\n`;
    message += `• "vente 10 pain" - Vendre 10 unités (calcul auto si prix défini)\n`;
    message += `• "vente 10 pain 3000" - Vendre 10 unités pour 3000 CFA\n`;
    message += `• "j'ai vendu 2000" - Vente rapide de 2000 CFA\n\n`;

    // Price commands (available to all roles)
    message += `💰 **PRIX**\n`;
    message += `• "prix pain 300" - Définir le prix unitaire\n`;
    message += `• "stock pain" - Voir stock et prix\n\n`;

    // Stock commands (available to all roles)
    message += `📦 **STOCK**\n`;
    message += `• "stock pain 10" - Mettre le stock de pain à 10\n`;
    message += `• "stock pain" - Voir le stock, prix et valeur\n`;
    message += `• "stock" - Voir tout le stock avec prix\n\n`;

    // Units commands (available to all roles)
    message += `📏 **UNITÉS MULTIPLES**\n`;
    message += `• "produit unité bière achat caisse 24 bouteille" - Configurer les unités\n`;
    message += `• "stock bière 5 caisse" - Ajouter du stock en unité d'achat\n`;
    message += `• "prix achat bière 12000 caisse" - Définir le prix d'achat\n`;
    message += `• "prix vente bière 40%" - Définir la marge de vente\n\n`;

    // Expenses (owner only)
    if (userRole === 'owner') {
      message += `💸 **DÉPENSES** (Propriétaire uniquement)\n`;
      message += `• "dépense 500" - Enregistrer une dépense de 500 CFA\n`;
      message += `• "dépense 300 marchandise" - Achat de marchandise\n`;
      message += `• "j'ai acheté 1000" - Dépense rapide\n\n`;
    }

    // Reports and balance
    message += `📊 **BILANS & RAPPORTS**\n`;
    message += `• "bilan" ou "bilan jour" - Bilan du jour (totaux)\n`;
    message += `• "transactions" - Liste détaillée avec produits\n`;
    message += `• "ventes jour" - Liste des ventes du jour\n`;
    message += `• "bilan semaine" - Bilan de la semaine\n`;
    message += `• "bilan mois" - Bilan du mois\n`;
    
    if (userRole === 'owner') {
      message += `• "rapport" ou "rapport PDF" - Générer un rapport PDF\n`;
    }

    message += `\n💡 **AIDE SPÉCIALISÉE**\n`;
    message += `• "aide ventes" - Aide sur les ventes\n`;
    message += `• "aide prix" - Aide sur la gestion des prix\n`;
    message += `• "aide stock" - Aide sur la gestion du stock\n`;
    message += `• "aide unités" - Aide sur les unités multiples\n`;
    message += `• "aide rapports" - Aide sur les rapports\n`;
    if (userRole === 'owner') {
      message += `• "aide dépenses" - Aide sur les dépenses\n`;
    }

    message += `\n🆘 **SUPPORT**\n`;
    message += `Tapez "aide" à tout moment pour revoir cette aide.`;

    return message;
  }

  /**
   * Sales-specific help
   */
  private getSalesHelpMessage(userRole?: string): string {
    return `🛒 **AIDE - GESTION DES VENTES**\n\n` +
           `📝 **FORMATS ACCEPTÉS :**\n\n` +
           `**Vente simple :**\n` +
           `• "vente 1000" - Vente de 1000 CFA\n` +
           `• "j'ai vendu 1500" - Vente de 1500 CFA\n` +
           `• "1000 vente" - Vente de 1000 CFA\n\n` +
           
           `**Vente avec produit :**\n` +
           `• "vente pain 500" - Vendre du pain à 500 CFA\n` +
           `• "j'ai vendu du riz 2000" - Vendre du riz à 2000 CFA\n` +
           `• "vente 800 café" - Vendre du café à 800 CFA\n\n` +
           
           `**Vente par quantité (NOUVEAU!):**\n` +
           `• "vente 10 pain" - Vendre 10 unités (calcul auto si prix défini)\n` +
           `• "vente 10 pain 3000" - Vendre 10 unités pour 3000 CFA\n` +
           `• "vente 5 pains" - Fonctionne aussi avec pluriels!\n\n` +
           
           `**Formats naturels :**\n` +
           `• "j'ai vendu du pain à 500" - Vente naturelle\n` +
           `• "j'ai vendu pour 1000" - Vente pour un montant\n\n` +
           
           `✨ **CALCUL AUTOMATIQUE (NOUVEAU!):**\n` +
           `Si vous définissez un prix unitaire, le montant est calculé automatiquement:\n` +
           `• "prix pain 300" (une seule fois)\n` +
           `• "vente 10 pain" → Montant calculé: 3,000 CFA ✨\n\n` +
           
           `💡 **CONSEILS :**\n` +
           `• Définissez les prix pour des ventes plus rapides\n` +
           `• Les pluriels sont reconnus (pain/pains, eau/eaux)\n` +
           `• Le stock est automatiquement décrémenté\n` +
           `• Les montants peuvent être avec ou sans "CFA"\n\n` +
           
           `📊 **SUIVI :**\n` +
           `• "bilan" - Voir les totaux\n` +
           `• "transactions" - Liste détaillée avec produits\n` +
           `• "ventes jour" - Toutes les ventes du jour`;
  }

  /**
   * Expenses-specific help
   */
  private getExpensesHelpMessage(userRole?: string): string {
    if (userRole !== 'owner') {
      return `❌ **ACCÈS RESTREINT**\n\n` +
             `La gestion des dépenses est réservée au propriétaire de l'entreprise.\n\n` +
             `💡 Contactez votre patron pour enregistrer des dépenses.`;
    }

    return `💸 **AIDE - GESTION DES DÉPENSES**\n\n` +
           `📝 **FORMATS ACCEPTÉS :**\n\n` +
           `**Dépense simple :**\n` +
           `• "dépense 500" - Dépense de 500 CFA\n` +
           `• "j'ai acheté 1000" - Achat de 1000 CFA\n` +
           `• "achat 750" - Achat de 750 CFA\n\n` +
           
           `**Dépense avec description :**\n` +
           `• "dépense 300 marchandise" - Achat de marchandise\n` +
           `• "j'ai acheté du riz 2000" - Achat de riz\n` +
           `• "achat 500 fournitures" - Achat de fournitures\n\n` +
           
           `**Formats naturels :**\n` +
           `• "j'ai acheté du pain à 200" - Achat naturel\n` +
           `• "dépense pour 800" - Dépense pour un montant\n\n` +
           
           `💡 **CONSEILS :**\n` +
           `• Soyez précis dans vos descriptions\n` +
           `• Les dépenses impactent directement votre bénéfice\n` +
           `• Toutes les dépenses sont tracées pour vos rapports\n\n` +
           
           `📊 **SUIVI :**\n` +
           `Les dépenses sont déduites de vos revenus dans les bilans et rapports.`;
  }

  /**
   * Stock-specific help
   */
  private getStockHelpMessage(userRole?: string): string {
    return `📦 **AIDE - GESTION DU STOCK**\n\n` +
           `📝 **METTRE À JOUR LE STOCK :**\n\n` +
           `• "stock pain 10" - Mettre le stock de pain à 10 unités\n` +
           `• "stock riz 25" - Mettre le stock de riz à 25 unités\n` +
           `• "maj stock café 5" - Mettre à jour le stock de café\n\n` +
           
           `🔍 **CONSULTER LE STOCK :**\n\n` +
           `• "stock pain" - Voir le stock de pain\n` +
           `• "stock" - Voir tout le stock\n` +
           `• "voir stock" - Afficher l'inventaire complet\n\n` +
           
           `⚠️ **ALERTES AUTOMATIQUES :**\n\n` +
           `• Stock à 0 : ⚠️ Rupture de stock\n` +
           `• Stock ≤ 5 : ⚠️ Stock faible\n` +
           `• Les ventes décrémenteront automatiquement le stock\n\n` +
           
           `💡 **CONSEILS :**\n` +
           `• Mettez à jour régulièrement vos stocks\n` +
           `• Surveillez les alertes de stock faible\n` +
           `• Le stock est partagé avec tous les employés\n\n` +
           
           `📊 **SUIVI :**\n` +
           `L'historique des mouvements de stock est conservé pour vos analyses.`;
  }

  /**
   * Price-specific help
   */
  private getPriceHelpMessage(userRole?: string): string {
    return `💰 **AIDE - GESTION DES PRIX**\n\n` +
           `📝 **DÉFINIR LES PRIX (NOUVEAU!):**\n\n` +
           `**Prix simple :**\n` +
           `• "prix pain 300" - Définir le prix unitaire du pain\n` +
           `• "prix eau 100" - Prix de l'eau à 100 CFA\n` +
           `• "prix cigarette 500" - Prix des cigarettes\n\n` +
           
           `**Prix avancé (avec unités) :**\n` +
           `• "prix achat bière 12000 caisse" - Prix d'achat en gros\n` +
           `• "prix vente bière 40%" - Définir la marge de vente\n` +
           `• "prix bière" - Voir tous les prix du produit\n\n` +
           
           `🔍 **CONSULTER LES PRIX :**\n\n` +
           `• "stock pain" - Voir le stock ET le prix\n` +
           `• "stock" - Voir tous les prix et valeurs\n` +
           `• "prix bière" - Détails des prix (unités multiples)\n\n` +
           
           `✨ **AVANTAGES DU PRIX DÉFINI :**\n\n` +
           `1. **Calcul automatique:**\n` +
           `   • "vente 10 pain" → Montant calculé automatiquement!\n` +
           `   • Plus besoin de calculer ou taper le montant\n\n` +
           
           `2. **Valeur du stock:**\n` +
           `   • "stock" → Voir la valeur totale de l'inventaire\n` +
           `   • Connître votre capital immobilisé\n\n` +
           
           `3. **Ventes plus rapides:**\n` +
           `   • Tapez juste la quantité, pas le montant\n` +
           `   • Moins d'erreurs de calcul\n\n` +
           
           `💡 **CONSEILS :**\n` +
           `• Définissez les prix de vos produits populaires\n` +
           `• Mettez à jour les prix si nécessaire\n` +
           `• Les prix peuvent être différents des prix d'achat\n` +
           `• Utilisez les unités multiples pour la vente en gros\n\n` +
           
           `📊 **EXEMPLE COMPLET :**\n` +
           `1. "prix pain 300" (définir le prix)\n` +
           `2. "vente 10 pain" (vente rapide)\n` +
           `3. "stock pain" (voir stock, prix, valeur)`;
  }

  /**
   * Reports-specific help
   */
  private getReportsHelpMessage(userRole?: string): string {
    let message = `📊 **AIDE - BILANS ET RAPPORTS**\n\n`;

    message += `📈 **BILANS (TOTAUX) :**\n\n`;
    message += `• "bilan" ou "bilan jour" - Bilan du jour (totaux)\n`;
    message += `• "bilan semaine" - Bilan de la semaine\n`;
    message += `• "bilan mois" - Bilan du mois\n\n`;

    message += `📋 **LISTE DÉTAILLÉE (NOUVEAU!) :**\n\n`;
    message += `• "transactions" - Liste complète avec produits et quantités\n`;
    message += `• "transactions semaine" - Transactions de la semaine\n`;
    message += `• "ventes jour" - Uniquement les ventes du jour\n`;
    message += `• "dépenses jour" - Uniquement les dépenses\n\n`;

    message += `🆚 **DIFFÉRENCE :**\n\n`;
    message += `**"bilan"** → Totaux et top produits\n`;
    message += `**"transactions"** → Liste détaillée avec:\n`;
    message += `  • Heure de chaque transaction\n`;
    message += `  • Produit et quantité vendus\n`;
    message += `  • Montant de chaque vente\n\n`;

    message += `📋 **INFORMATIONS DANS BILAN :**\n\n`;
    message += `• 💰 Total des ventes\n`;
    if (userRole === 'owner') {
      message += `• 💸 Total des dépenses\n`;
      message += `• 📈 Bénéfice net (ventes - dépenses)\n`;
    }
    message += `• 📊 Nombre de transactions\n`;
    message += `• 🏆 Top 3 des produits vendus\n\n`;

    if (userRole === 'owner') {
      message += `📄 **RAPPORTS PDF :**\n\n`;
      message += `• "rapport" - Rapport PDF du jour\n`;
      message += `• "rapport semaine" - Rapport PDF de la semaine\n`;
      message += `• "rapport mois" - Rapport PDF du mois\n\n`;
      message += `📧 Le rapport PDF sera envoyé directement sur WhatsApp.\n\n`;
    }

    message += `💡 **CONSEILS :**\n`;
    message += `• Utilisez "bilan" pour un aperçu rapide\n`;
    message += `• Utilisez "transactions" pour voir les détails\n`;
    message += `• Consultez vos rapports régulièrement\n`;
    if (userRole === 'owner') {
      message += `• Les rapports PDF sont parfaits pour la comptabilité\n`;
    }

    return message;
  }

  /**
   * Units-specific help
   */
  private getUnitsHelpMessage(userRole?: string): string {
    return `📏 **AIDE - GESTION DES UNITÉS MULTIPLES**\n\n` +
           `🎯 **CONCEPT :**\n` +
           `Achetez en gros (caisses, sacs, cartons) et vendez au détail (bouteilles, pièces, kg).\n` +
           `Le système gère automatiquement les conversions !\n\n` +
           
           `⚙️ **1. CONFIGURATION DES UNITÉS**\n\n` +
           `**Format :** produit unité [produit] achat [unité_achat] [facteur] [unité_base]\n\n` +
           `**Exemples :**\n` +
           `• "produit unité bière achat caisse 24 bouteille"\n` +
           `• "produit unité riz achat sac 50 kg"\n` +
           `• "produit unité savon achat carton 12 pièce"\n` +
           `• "produit unité eau achat casier 12 bouteille"\n\n` +
           
           `📦 **2. GESTION DU STOCK AVEC UNITÉS**\n\n` +
           `**Ajouter du stock :**\n` +
           `• "stock bière 5 caisse" - Ajoute 5 caisses (120 bouteilles)\n` +
           `• "stock riz 10 sac" - Ajoute 10 sacs (500 kg)\n` +
           `• "stock savon 3 carton" - Ajoute 3 cartons (36 pièces)\n\n` +
           
           `**Consulter le stock :**\n` +
           `• "stock bière" - Affiche : "245 bouteilles (10 caisses + 5 bouteilles)"\n` +
           `• "stock" - Affiche tout le stock avec conversions\n\n` +
           
           `💰 **3. GESTION DES PRIX**\n\n` +
           `**Prix d'achat :**\n` +
           `• "prix achat bière 12000 caisse" - 12,000 CFA par caisse\n` +
           `• "prix achat riz 25000 sac" - 25,000 CFA par sac\n\n` +
           
           `**Marge de vente :**\n` +
           `• "prix vente bière 40%" - Marge de 40%\n` +
           `• "prix vente riz 30%" - Marge de 30%\n\n` +
           
           `**Consulter les prix :**\n` +
           `• "prix bière" - Affiche tous les prix et marges\n\n` +
           
           `🛒 **4. VENTES (Toujours en unité de base)**\n\n` +
           `• "vente 2100 bière 3" - Vend 3 bouteilles pour 2,100 CFA\n` +
           `• "vente 1400 bière 2" - Vend 2 bouteilles pour 1,400 CFA\n\n` +
           
           `🔔 **5. ALERTES DE STOCK**\n\n` +
           `• "alerte bière 2 caisse" - Alerte quand < 2 caisses\n` +
           `• "alerte riz 5 sac" - Alerte quand < 5 sacs\n\n` +
           
           `📋 **6. HISTORIQUE ET CONSULTATION**\n\n` +
           `• "historique bière" - Voir tous les mouvements\n` +
           `• "produit unité bière" - Voir la configuration actuelle\n\n` +
           
           `🏆 **EXEMPLES COMPLETS**\n\n` +
           `**Configuration complète d'un produit :**\n` +
           `1. "produit unité bière achat caisse 24 bouteille"\n` +
           `2. "prix achat bière 12000 caisse"\n` +
           `3. "prix vente bière 40%"\n` +
           `4. "alerte bière 2 caisse"\n` +
           `5. "stock bière 10 caisse"\n\n` +
           
           `**Gestion quotidienne :**\n` +
           `• "stock bière" - Vérifier le stock\n` +
           `• "vente 700 bière 1" - Vendre 1 bouteille\n` +
           `• "stock bière 5 caisse" - Réapprovisionner\n\n` +
           
           `💡 **CONSEILS :**\n` +
           `• Commencez par vos 3-5 produits les plus vendus\n` +
           `• Utilisez des facteurs simples (12, 24, 50)\n` +
           `• Configurez les alertes pour éviter les ruptures\n` +
           `• Les ventes se font toujours en unité de base\n\n` +
           
           `🔧 **DÉPANNAGE :**\n` +
           `• "Unités non configurées" → Configurez d'abord avec "produit unité"\n` +
           `• "Unité inconnue" → Vérifiez avec "produit unité [produit]"\n` +
           `• "Stock insuffisant" → Vérifiez avec "stock [produit]"`;
  }

  /**
   * Commands-specific help
   */
  private getCommandsHelpMessage(userRole?: string): string {
    return `⌨️ **AIDE - TOUTES LES COMMANDES**\n\n` +
           `🛒 **VENTES :**\n` +
           `vente, vendu, j'ai vendu, sale\n\n` +
           
           `💸 **DÉPENSES :** ${userRole === 'owner' ? '' : '(Propriétaire uniquement)'}\n` +
           `dépense, depense, expense, achat, acheté, j'ai acheté\n\n` +
           
           `📦 **STOCK :**\n` +
           `stock, maj stock, update stock, voir stock\n\n` +
           
           `📏 **UNITÉS MULTIPLES :**\n` +
           `produit unité, stock [produit] [quantité] [unité], prix achat, prix vente, alerte, historique\n\n` +
           
           `📊 **BILANS :**\n` +
           `bilan, balance, résumé, resume\n\n` +
           
           `📄 **RAPPORTS :**\n` +
           `rapport, report\n\n` +
           
           `🆘 **AIDE :**\n` +
           `aide, help, ?, aidez-moi\n\n` +
           
           `💡 **FORMATS FLEXIBLES :**\n` +
           `• Vous pouvez écrire en français\n` +
           `• Les montants acceptent les virgules : "1,500"\n` +
           `• Les unités CFA sont optionnelles\n` +
           `• L'ordre des mots est flexible\n\n` +
           
           `📝 **EXEMPLES COMPLETS :**\n` +
           `• "j'ai vendu du pain pour 500 CFA"\n` +
           `• "dépense 1,200 marchandise"\n` +
           `• "stock pain 15 unités"\n` +
           `• "produit unité bière achat caisse 24 bouteille"\n` +
           `• "stock bière 5 caisse"\n` +
           `• "prix achat bière 12000 caisse"\n` +
           `• "bilan de la semaine"`;
  }

  /**
   * Get role text in French
   */
  private getRoleText(role?: string): string {
    switch (role) {
      case 'owner':
        return 'Propriétaire';
      case 'seller':
        return 'Vendeur';
      case 'manager':
        return 'Gérant';
      default:
        return 'Utilisateur';
    }
  }
}