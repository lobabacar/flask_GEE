import os
import ee
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
#from flask_cors import CORS # Import à ajouter

load_dotenv()

app = Flask(__name__)
#CORS(app) # Activer CORS pour toutes les routes
# Initialisation GEE (déjà testée)
SERVICE_ACCOUNT = os.getenv('GEE_SERVICE_ACCOUNT')
KEY_FILE = os.getenv('GEE_JSON_KEY_PATH')
credentials = ee.ServiceAccountCredentials(SERVICE_ACCOUNT, KEY_FILE)
ee.Initialize(credentials)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_ndvi_tile', methods=['POST'])
def get_ndvi_tile():
    data = request.json
    target_date = data.get('date', '2023-06-01')
    
    # Zone d'intérêt (on prend un point par défaut, ex: Dakar)
    lon, lat = -17.44, 14.69
    poi = ee.Geometry.Point([lon, lat])

    # Collection Sentinel-2
    image = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
             .filterBounds(poi)
             .filterDate(ee.Date(target_date).advance(-1, 'month'), 
                         ee.Date(target_date).advance(1, 'month'))
             .sort('CLOUDY_PIXEL_PERCENTAGE')
             .first())

    if not image:
        return jsonify({'error': 'Pas d\'image trouvée'}), 404

    # Calcul NDVI
    ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')

    # Paramètres de visualisation
    vis_params = {
        'min': 0, 
        'max': 1, 
        'palette': ['#ece7f2', '#addd8e', '#31a354'] # Teintes de vert
    }

    # Générer l'URL des tuiles
    map_id = ndvi.getMapId(vis_params)
    return jsonify({'tile_url': map_id['tile_fetcher'].url_format})

if __name__ == '__main__':
    app.run(debug=True)