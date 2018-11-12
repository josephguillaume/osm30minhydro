async function load_ddm30_basins(mapLayers, select_basin) {
  const response = await fetch("data/ddm30_basins.topojson");
  const basins_topojson = await response.json();
  const basins = await topojson.feature(
    basins_topojson,
    basins_topojson.objects.basins
  );

  const subbasinsStyle = {
    color: "grey",
    weight: 3,
    opacity: 0.65,
    fillOpacity: 0.05 // needed to allow clicking
  };

  mapLayers.data.basins = await basins;

  await mapLayers.add(
    L.geoJson(basins, {
      style: subbasinsStyle,
      onEachFeature: function(feature, layer) {
        layer.on("click", function(e) {
          select_basin(e.target.feature.properties.basin_id);
        });
      }
    }),
    "Basins"
  );
}

async function fetch_ddm30_lines(mapLayers) {
  const response = await fetch("data/ddm_lines_cells.json");
  const ddm30_lines = await response.json();

  mapLayers.data.ddm_lines_cells = await ddm30_lines;
}

load_basin_ddm = function(mapLayers, basin_id) {
  mapLayers.remove("basin_ddm");

  const ddmLinesStyle = {
    color: "black",
    weight: 2,
    opacity: 0.65,
    clickable: false
  };

  layer_ddmLines_cells_line = L.geoJson(mapLayers.data.ddm_lines_cells, {
    style: ddmLinesStyle,
    filter: (feature, layer) => feature.properties.basin == basin_id
  });
  layer_ddmLines_cells_arrowhead = L.polylineDecorator(
    layer_ddmLines_cells_line.getLayers(),
    {
      patterns: [
        {
          offset: "100%",
          repeat: 0,
          symbol: L.Symbol.arrowHead({
            pixelSize: 10,
            pathOptions: { fillOpacity: 1, weight: 0, color: "black" }
          })
        }
      ]
    }
  );
  layer_ddmLines_cells = L.layerGroup([
    layer_ddmLines_cells_line,
    layer_ddmLines_cells_arrowhead
  ]);
  mapLayers.add(layer_ddmLines_cells, "basin_ddm");
};

async function get_basin_wiki(object = window) {
  const response = await fetch("basin_wiki.csv");
  const text = await response.text();
  object["basin_wiki"] = await text
    .split("\n")
    .map(line => line.split(",").map(cell => cell.replace(/"/g, "")));
}
