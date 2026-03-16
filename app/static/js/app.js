const rasterLayer = new ol.layer.Tile({
    source: new ol.source.OSM()
});

const drawSource = new ol.source.Vector();

const drawLayer = new ol.layer.Vector({
    source: drawSource,
    style: new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#ff0000',
            width: 2
        }),
        fill: new ol.style.Fill({
            color: 'rgba(255, 0, 0, 0.12)'
        })
    })
});

const map = new ol.Map({
    target: 'map',
    layers: [rasterLayer, drawLayer],
    view: new ol.View({
        center: ol.proj.fromLonLat([-17.44, 14.69]),
        zoom: 9
    })
});

let drawInteraction = null;
let ndviLayer = null;
let selectedGeometry = null;

const geojsonFormat = new ol.format.GeoJSON();

function setStatus(message, className = "muted") {
    const el = document.getElementById("statusMessage");
    el.textContent = message;
    el.className = className;
}

function setStats(stats = null, imgCount = "-", startDate = "-", endDate = "-") {
    document.getElementById("ndviMean").textContent = stats?.mean != null ? Number(stats.mean).toFixed(3) : "-";
    document.getElementById("ndviMin").textContent = stats?.min != null ? Number(stats.min).toFixed(3) : "-";
    document.getElementById("ndviMax").textContent = stats?.max != null ? Number(stats.max).toFixed(3) : "-";
    document.getElementById("ndviStd").textContent = stats?.stdDev != null ? Number(stats.stdDev).toFixed(3) : "-";
    document.getElementById("imgCount").textContent = imgCount ?? "-";
    document.getElementById("dateWindow").textContent = `${startDate} → ${endDate}`;
}

function removeDrawInteraction() {
    if (drawInteraction) {
        map.removeInteraction(drawInteraction);
        drawInteraction = null;
    }
}

function clearDrawings() {
    drawSource.clear();
    selectedGeometry = null;
    setStatus("Zone effacée.", "muted");
    setStats();

    if (ndviLayer) {
        map.removeLayer(ndviLayer);
        ndviLayer = null;
    }
}

function startPolygonDraw() {
    clearDrawings();
    removeDrawInteraction();

    setStatus("Dessinez un polygone sur la carte.", "loading");

    drawInteraction = new ol.interaction.Draw({
        source: drawSource,
        type: 'Polygon'
    });

    map.addInteraction(drawInteraction);

    drawInteraction.on('drawend', function (evt) {
        drawSource.clear();
        drawSource.addFeature(evt.feature);

        const geom4326 = evt.feature.getGeometry().clone().transform('EPSG:3857', 'EPSG:4326');
        selectedGeometry = geojsonFormat.writeGeometryObject(geom4326);

        removeDrawInteraction();
        setStatus("Polygone sélectionné.", "success");
    });
}

function startRectangleDraw() {
    clearDrawings();
    removeDrawInteraction();

    setStatus("Dessinez un rectangle sur la carte.", "loading");

    drawInteraction = new ol.interaction.Draw({
        source: drawSource,
        type: 'Circle',
        geometryFunction: ol.interaction.Draw.createBox()
    });

    map.addInteraction(drawInteraction);

    drawInteraction.on('drawend', function (evt) {
        drawSource.clear();
        drawSource.addFeature(evt.feature);

        const geom4326 = evt.feature.getGeometry().clone().transform('EPSG:3857', 'EPSG:4326');
        selectedGeometry = geojsonFormat.writeGeometryObject(geom4326);

        removeDrawInteraction();
        setStatus("Rectangle sélectionné.", "success");
    });
}

async function loadNDVI() {
    const date = document.getElementById("datePicker").value;

    if (!date) {
        setStatus("Veuillez choisir une date.", "error");
        return;
    }

    if (!selectedGeometry) {
        setStatus("Veuillez dessiner une zone sur la carte.", "error");
        return;
    }

    setStatus("Calcul du NDVI en cours...", "loading");

    try {
        const response = await fetch("/get_ndvi_tile", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                date: date,
                geometry: selectedGeometry
            })
        });

        const data = await response.json();

        if (!response.ok) {
            setStatus(data.error || "Erreur lors de la récupération du NDVI.", "error");
            setStats();
            return;
        }

        if (ndviLayer) {
            map.removeLayer(ndviLayer);
        }

        ndviLayer = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: data.tile_url,
                crossOrigin: 'anonymous'
            }),
            opacity: 0.72
        });

        map.addLayer(ndviLayer);

        setStats(
            data.stats,
            data.images_found,
            data.start_date_used,
            data.end_date_used
        );

        setStatus("NDVI chargé avec succès.", "success");

    } catch (error) {
        console.error(error);
        setStatus("Erreur réseau ou serveur.", "error");
    }
}

document.getElementById("drawPolygonBtn").addEventListener("click", startPolygonDraw);
document.getElementById("drawRectangleBtn").addEventListener("click", startRectangleDraw);
document.getElementById("clearBtn").addEventListener("click", clearDrawings);
document.getElementById("showNdviBtn").addEventListener("click", loadNDVI);