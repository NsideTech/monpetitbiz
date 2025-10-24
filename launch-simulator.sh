#!/bin/bash

echo "🚀 Lancement du Simulateur WhatsApp Offline"
echo ""
echo "✨ Fonctionnalités du simulateur:"
echo "• Messages illimités sans Twilio"
echo "• Support des nouveaux formats de vente"
echo "• Simulation complète de la logique"
echo "• Interface WhatsApp réaliste"
echo ""

# Ouvrir le simulateur dans le navigateur par défaut
if command -v open &> /dev/null; then
    # macOS
    open whatsapp-offline-simulator.html
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open whatsapp-offline-simulator.html
elif command -v start &> /dev/null; then
    # Windows
    start whatsapp-offline-simulator.html
else
    echo "📱 Ouvrez manuellement le fichier whatsapp-offline-simulator.html dans votre navigateur"
fi

echo "✅ Simulateur lancé !"
echo ""
echo "💡 Testez les nouveaux formats de vente:"
echo "• vente 10 pain 2500 (quantité + produit + montant)"
echo "• vente 5 pain (quantité + produit)"
echo "• vente pain 500 (produit + montant)"
echo "• vente 1000 (montant seul)"