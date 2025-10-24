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

    if (language === 'wo') {
      return this.getWolofHelpMessage(category, context);
    }

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
      
      case 'reports':
        return this.getReportsHelpMessage(userRole);
      
      case 'commands':
        return this.getCommandsHelpMessage(userRole);
      
      case 'general':
      default:
        return this.getGeneralHelpMessage(userRole, businessName);
    }
  }

  /**
   * Get Wolof help messages
   */
  private getWolofHelpMessage(category: string, context: HelpContext): string {
    const { userRole } = context;

    switch (category) {
      case 'sales':
        return `🛒 **JAAY (Ventes)**\n\n` +
               `• "jaay 1000" - jaay bu 1000 CFA\n` +
               `• "jaay mburu 500" - jaay mburu ci 500 CFA\n` +
               `• "man jaay ceeb 2000" - man jaay ceeb ci 2000 CFA\n\n` +
               `💡 Wax "ndimbal jaay" ngir gën wax yu bari.`;

      case 'general':
      default:
        return `👋 **NDIMBAL (Aide)**\n\n` +
               `🛒 **Jaay (Ventes):** "jaay 1000 mburu"\n` +
               `💸 **Jënd (Achats):** "jënd 500 ataya"\n` +
               `📦 **Stock:** "stock mburu 10"\n` +
               `📊 **Bilan:** "bilan tey"\n\n` +
               `💡 Wax "ndimbal" ak sa bëgg-bëgg ngir gën ndimbal yu bari.`;
    }
  }

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
    message += `• "vente pain 500" - Vendre du pain à 500 CFA\n`;
    message += `• "j'ai vendu 2000" - Vente rapide de 2000 CFA\n\n`;

    // Stock commands (available to all roles)
    message += `📦 **STOCK**\n`;
    message += `• "stock pain 10" - Mettre le stock de pain à 10\n`;
    message += `• "stock pain" - Voir le stock de pain\n`;
    message += `• "stock" - Voir tout le stock\n\n`;

    // Expenses (owner only)
    if (userRole === 'owner') {
      message += `💸 **DÉPENSES** (Propriétaire uniquement)\n`;
      message += `• "dépense 500" - Enregistrer une dépense de 500 CFA\n`;
      message += `• "dépense 300 marchandise" - Achat de marchandise\n`;
      message += `• "j'ai acheté 1000" - Dépense rapide\n\n`;
    }

    // Reports and balance
    message += `📊 **BILANS & RAPPORTS**\n`;
    message += `• "bilan" ou "bilan jour" - Bilan du jour\n`;
    message += `• "bilan semaine" - Bilan de la semaine\n`;
    message += `• "bilan mois" - Bilan du mois\n`;
    
    if (userRole === 'owner') {
      message += `• "rapport" ou "rapport PDF" - Générer un rapport PDF\n`;
    }

    message += `\n💡 **AIDE SPÉCIALISÉE**\n`;
    message += `• "aide ventes" - Aide sur les ventes\n`;
    message += `• "aide stock" - Aide sur la gestion du stock\n`;
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
           
           `**Formats naturels :**\n` +
           `• "j'ai vendu du pain à 500" - Vente naturelle\n` +
           `• "j'ai vendu pour 1000" - Vente pour un montant\n\n` +
           
           `💡 **CONSEILS :**\n` +
           `• Les montants peuvent être avec ou sans "CFA"\n` +
           `• Vous pouvez utiliser des virgules : "1,500"\n` +
           `• Le stock sera automatiquement mis à jour si configuré\n\n` +
           
           `📊 **SUIVI :**\n` +
           `Toutes vos ventes sont automatiquement comptabilisées dans vos bilans quotidiens, hebdomadaires et mensuels.`;
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
   * Reports-specific help
   */
  private getReportsHelpMessage(userRole?: string): string {
    let message = `📊 **AIDE - BILANS ET RAPPORTS**\n\n`;

    message += `📈 **BILANS DISPONIBLES :**\n\n`;
    message += `• "bilan" ou "bilan jour" - Bilan du jour actuel\n`;
    message += `• "bilan semaine" - Bilan de la semaine en cours\n`;
    message += `• "bilan mois" - Bilan du mois en cours\n\n`;

    message += `📋 **INFORMATIONS INCLUSES :**\n\n`;
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
    message += `• Consultez vos bilans régulièrement\n`;
    message += `• Utilisez les rapports pour analyser vos performances\n`;
    if (userRole === 'owner') {
      message += `• Les rapports PDF sont parfaits pour la comptabilité\n`;
    }

    return message;
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
           
           `📊 **BILANS :**\n` +
           `bilan, balance, résumé, resume\n\n` +
           
           `📄 **RAPPORTS :**\n` +
           `rapport, report\n\n` +
           
           `🆘 **AIDE :**\n` +
           `aide, help, ?, aidez-moi\n\n` +
           
           `💡 **FORMATS FLEXIBLES :**\n` +
           `• Vous pouvez écrire en français ou en wolof\n` +
           `• Les montants acceptent les virgules : "1,500"\n` +
           `• Les unités CFA sont optionnelles\n` +
           `• L'ordre des mots est flexible\n\n` +
           
           `📝 **EXEMPLES COMPLETS :**\n` +
           `• "j'ai vendu du pain pour 500 CFA"\n` +
           `• "dépense 1,200 marchandise"\n` +
           `• "stock pain 15 unités"\n` +
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