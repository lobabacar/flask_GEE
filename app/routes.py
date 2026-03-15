from flask import Blueprint, render_template, request, jsonify
import ee
import os
import json

main = Blueprint("main", __name__)

def init_gee():
    service_account = os.getenv("GEE_SERVICE_ACCOUNT")
    private_key_json = os.getenv("GEE_PRIVATE_KEY_JSON")

    if not service_account:
        raise RuntimeError("GEE_SERVICE_ACCOUNT manquant")
    if not private_key_json:
        raise RuntimeError("GEE_PRIVATE_KEY_JSON manquant")

    credentials = ee.ServiceAccountCredentials(
        service_account,
        key_data=private_key_json
    )
    ee.Initialize(credentials)


init_gee()


@main.route("/")
def index():
    return render_template("index.html")


@main.route("/get_ndvi_tile", methods=["POST"])
def get_ndvi_tile():

    data = request.get_json()

    date = data.get("date")

    point = ee.Geometry.Point([-17.44, 14.69])

    image = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(point)
        .filterDate(date, date)
        .sort("CLOUDY_PIXEL_PERCENTAGE")
        .first()
    )

    ndvi = image.normalizedDifference(["B8", "B4"])

    map_id = ndvi.getMapId({
        "min": 0,
        "max": 1,
        "palette": ["blue", "white", "green"]
    })

    return jsonify({
        "tile_url": map_id["tile_fetcher"].url_format
    })