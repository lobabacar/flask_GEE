import ee
import os
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

# Récupérer les variables
SERVICE_ACCOUNT = os.getenv('GEE_SERVICE_ACCOUNT')
KEY_FILE = os.getenv('GEE_JSON_KEY_PATH')

if not SERVICE_ACCOUNT or not KEY_FILE:
    print("Erreur : Les variables GEE_SERVICE_ACCOUNT ou GEE_JSON_KEY_PATH sont introuvables.")
else:
    try:
        # Utilisation des identifiants du compte de service
        credentials = ee.ServiceAccountCredentials(SERVICE_ACCOUNT, KEY_FILE)

        # Initialisation de la bibliothèque
        ee.Initialize(credentials)

        # Test rapide : afficher les infos d'une image
        image = ee.Image('USGS/SRTMGL1_003')
        print("Connexion réussie !")
        print(image.getInfo())
        
    except Exception as e:
        print(f"Une erreur est survenue lors de l'initialisation : {e}")