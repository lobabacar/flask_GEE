let ndviChart = null;

const osmLayer = new ol.layer.Tile({
    source: new ol.source.OSM(),
    visible: true
});

const esriSatelliteLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        crossOrigin: 'anonymous'
    }),
    visible: false
});

const topoLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
        crossOrigin: 'anonymous'
    }),
    visible: false
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
            color: 'rgba(255, 0, 0, 0.10)'
        })
    })
});

const map = new ol.Map({
    target: 'map',
    layers: [osmLayer, esriSatelliteLayer, topoLayer, drawLayer],
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

    if (ndviChart) {
        ndviChart.destroy();
        ndviChart = null;
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

function switchBasemap(value) {
    osmLayer.setVisible(value === "osm");
    esriSatelliteLayer.setVisible(value === "satellite");
    topoLayer.setVisible(value === "topo");
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

async function loadNDVITimeSeries() {
    const startDate = document.getElementById("tsStartDate").value;
    const endDate = document.getElementById("tsEndDate").value;

    if (!startDate || !endDate) {
        setStatus("Veuillez renseigner la période du graphique.", "error");
        return;
    }

    if (!selectedGeometry) {
        setStatus("Veuillez dessiner une zone avant de charger le graphique.", "error");
        return;
    }

    setStatus("Chargement de la série temporelle NDVI...", "loading");

    try {
        const response = await fetch("/get_ndvi_timeseries", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                start_date: startDate,
                end_date: endDate,
                geometry: selectedGeometry
            })
        });

        const data = await response.json();

        if (!response.ok) {
            setStatus(data.error || "Erreur lors du chargement du graphique.", "error");
            return;
        }

        const labels = data.series.map(item => item.date);
        const values = data.series.map(item => item.mean_ndvi);

        if (ndviChart) {
            ndviChart.destroy();
        }

        const ctx = document.getElementById("ndviChart").getContext("2d");
        ndviChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: "NDVI moyen",
                    data: values,
                    borderWidth: 2,
                    tension: 0.2,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: "#ffffff"
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: "#ffffff",
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: {
                            color: "rgba(255,255,255,0.08)"
                        }
                    },
                    y: {
                        ticks: {
                            color: "#ffffff"
                        },
                        grid: {
                            color: "rgba(255,255,255,0.08)"
                        },
                        title: {
                            display: true,
                            text: "NDVI",
                            color: "#ffffff"
                        }
                    }
                }
            }
        });

        setStatus(`Graphique NDVI chargé (${data.count} dates).`, "success");

    } catch (error) {
        console.error(error);
        setStatus("Erreur réseau ou serveur pour le graphique.", "error");
    }
}

document.getElementById("drawPolygonBtn").addEventListener("click", startPolygonDraw);
document.getElementById("drawRectangleBtn").addEventListener("click", startRectangleDraw);
document.getElementById("clearBtn").addEventListener("click", clearDrawings);
document.getElementById("showNdviBtn").addEventListener("click", loadNDVI);
document.getElementById("loadChartBtn").addEventListener("click", loadNDVITimeSeries);
document.getElementById("basemapSelect").addEventListener("change", function () {
    switchBasemap(this.value);
});