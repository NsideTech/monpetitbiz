import { Injectable } from '@nestjs/common';

/**
 * Service pour normaliser les noms de produits et gérer les correspondances singulier/pluriel
 */
@Injectable()
export class ProductNormalizerService {

    // Dictionnaire des correspondances irrégulières
    private readonly irregularPlurals: Map<string, string> = new Map([
        // Pluriels irréguliers français courants
        ['eau', 'eaux'],
        ['cheval', 'chevaux'],
        ['animal', 'animaux'],
        ['journal', 'journaux'],
        ['travail', 'travaux'],
        ['oeil', 'yeux'],
        ['ciel', 'cieux'],
        ['oeuf', 'oeufs'],

        // Mots invariables
        ['riz', 'riz'],
        ['mais', 'mais'],
        ['ananas', 'ananas'],
        ['bois', 'bois'],
        ['prix', 'prix'],
        ['choix', 'choix'],

        // Mots composés courants
        ['pomme de terre', 'pommes de terre'],
        ['eau de vie', 'eaux de vie'],
        ['chef d\'oeuvre', 'chefs d\'oeuvre'],
        ['arc en ciel', 'arcs en ciel'],
    ]);

    // Créer un dictionnaire bidirectionnel (singulier ↔ pluriel)
    private readonly bidirectionalMap: Map<string, string> = new Map();

    constructor() {
        this.initializeBidirectionalMap();
    }

    private initializeBidirectionalMap(): void {
        // Ajouter les correspondances dans les deux sens
        for (const [singular, plural] of this.irregularPlurals.entries()) {
            this.bidirectionalMap.set(singular, plural);
            this.bidirectionalMap.set(plural, singular);
        }
    }

    /**
     * Normalise un nom de produit en minuscules et supprime les espaces superflus
     */
    normalize(product: string): string {
        if (!product || typeof product !== 'string') {
            return '';
        }

        return product.trim().toLowerCase().replace(/\s+/g, ' ');
    }

    /**
     * Trouve toutes les variantes possibles d'un produit (singulier, pluriel, variations)
     */
    getProductVariants(product: string): string[] {
        const normalized = this.normalize(product);
        const variants = new Set<string>([normalized]);

        // 1. Vérifier dans le dictionnaire des irréguliers
        if (this.bidirectionalMap.has(normalized)) {
            variants.add(this.bidirectionalMap.get(normalized)!);
        }

        // 2. Générer les variantes régulières
        if (normalized.endsWith('s')) {
            // Si se termine par 's', essayer la forme sans 's'
            const withoutS = normalized.slice(0, -1);
            variants.add(withoutS);
        } else {
            // Si ne se termine pas par 's', essayer avec 's'
            variants.add(normalized + 's');
        }

        // 3. Variantes avec 'x' pour les mots en '-eau', '-eu'
        if (normalized.endsWith('eau') || normalized.endsWith('eu')) {
            variants.add(normalized + 'x');
        }
        if (normalized.endsWith('eaux') || normalized.endsWith('eux')) {
            const withoutX = normalized.slice(0, -1);
            variants.add(withoutX);
        }

        // 4. Variantes pour les mots en '-al'
        if (normalized.endsWith('al')) {
            variants.add(normalized.slice(0, -2) + 'aux');
        }
        if (normalized.endsWith('aux')) {
            variants.add(normalized.slice(0, -3) + 'al');
        }

        return Array.from(variants);
    }

    /**
     * Trouve la forme canonique (préférée) d'un produit
     * Privilégie le singulier sauf pour les mots naturellement pluriels
     */
    getCanonicalForm(product: string): string {
        const normalized = this.normalize(product);

        // Mots naturellement pluriels
        const naturallyPlural = ['lunettes', 'ciseaux', 'frais', 'gens'];
        if (naturallyPlural.includes(normalized)) {
            return normalized;
        }

        // Pour les mots irréguliers, retourner la forme singulière
        for (const [singular, plural] of this.irregularPlurals.entries()) {
            if (normalized === plural) {
                return singular;
            }
            if (normalized === singular) {
                return singular;
            }
        }

        // Pour les mots réguliers, privilégier le singulier
        if (normalized.endsWith('s') && normalized.length > 1) {
            const singular = normalized.slice(0, -1);
            // Vérifier que ce n'est pas un mot qui se termine naturellement par 's'
            const endsWithS = ['riz', 'mais', 'ananas', 'bois', 'prix', 'choix', 'pays'];
            if (!endsWithS.includes(normalized)) {
                return singular;
            }
        }

        return normalized;
    }

    /**
     * Ajoute une correspondance personnalisée au dictionnaire
     */
    addCustomMapping(singular: string, plural: string): void {
        const normalizedSingular = this.normalize(singular);
        const normalizedPlural = this.normalize(plural);

        this.irregularPlurals.set(normalizedSingular, normalizedPlural);
        this.bidirectionalMap.set(normalizedSingular, normalizedPlural);
        this.bidirectionalMap.set(normalizedPlural, normalizedSingular);
    }

    /**
     * Trouve le meilleur match parmi une liste de produits existants
     */
    findBestMatch(searchProduct: string, existingProducts: string[]): string | null {
        const searchVariants = this.getProductVariants(searchProduct);

        // Chercher une correspondance exacte d'abord
        for (const variant of searchVariants) {
            if (existingProducts.includes(variant)) {
                return variant;
            }
        }

        // Chercher une correspondance partielle (pour les mots composés)
        const searchNormalized = this.normalize(searchProduct);
        for (const existing of existingProducts) {
            const existingNormalized = this.normalize(existing);

            // Vérifier si l'un contient l'autre (pour les mots composés)
            if (searchNormalized.includes(existingNormalized) || existingNormalized.includes(searchNormalized)) {
                return existing;
            }
        }

        return null;
    }
}